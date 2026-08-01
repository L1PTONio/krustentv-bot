import { createHash } from 'node:crypto';

export class ConflictError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ConflictError';
    this.code = 'CONFLICT';
    this.cause = options.cause;
  }
}

export class W2GServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'W2GServiceError';
    this.code = options.code || 'W2G_ERROR';
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

function hashPayload(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

function createSimpleQueue() {
  const pending = [];
  let active = false;
  let tail = Promise.resolve();

  return {
    run(task) {
      const runPromise = tail.then(() => task()).finally(() => {
        if (pending.length > 0) {
          const next = pending.shift();
          next();
        } else {
          active = false;
        }
      });
      tail = runPromise.catch(() => {});
      if (!active) {
        active = true;
        return runPromise;
      }
      pending.push(() => {});
      return runPromise;
    }
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new W2GServiceError('No videos to push');
  }

  return items.map(item => ({
    url: typeof item?.url === 'string' ? item.url.trim() : '',
    title: typeof item?.title === 'string' ? item.title.trim() : 'Unbekanntes Video'
  })).filter(item => item.url);
}

export function createW2GService({ dryRun = false, fetchImpl = fetch } = {}) {
  const queue = createSimpleQueue();
  const jobs = new Map();

  async function createPushJob(items, idempotencyKey) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      throw new W2GServiceError('idempotencyKey is required');
    }

    const normalizedItems = normalizeItems(items);
    const payloadHash = hashPayload(normalizedItems);
    const existing = Array.from(jobs.values()).find(job => job.idempotencyKey === idempotencyKey);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new ConflictError(`Idempotency key ${idempotencyKey} already exists with a different payload`);
      }
      if (existing.status === 'succeeded' && existing.result) {
        return existing;
      }
      return existing;
    }

    const job = {
      id: `job-${jobs.size + 1}`,
      idempotencyKey: idempotencyKey.trim(),
      payloadHash,
      status: 'pending',
      items: normalizedItems.map((item, index) => ({ id: `${idempotencyKey}-${index}`, item, status: 'pending' })),
      createdAt: new Date().toISOString()
    };
    jobs.set(job.id, job);
    return job;
  }

  async function pushVideosToW2G(items, options = {}) {
    const normalizedItems = normalizeItems(items);

    const idempotencyKey = options.idempotencyKey || `push-${Date.now()}`;
    const job = await createPushJob(normalizedItems, idempotencyKey);
    if (job.status === 'succeeded' && job.result) {
      return { job, result: job.result };
    }

    return queue.run(async () => {
      if (dryRun) {
        const result = { success: true, dryRun: true, jobId: job.id, itemCount: normalizedItems.length };
        job.status = 'succeeded';
        job.result = result;
        return { job, result };
      }

      try {
        const response = await fetchImpl('https://example.test', {
          method: 'POST',
          body: JSON.stringify(normalizedItems)
        });
        const text = await response.text();
        job.status = 'succeeded';
        job.result = { success: true, body: text };
        return { job, result: job.result };
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        throw new W2GServiceError('W2G push failed', { cause: error, retryable: true });
      }
    });
  }

  return {
    createPushJob,
    pushVideosToW2G
  };
}
