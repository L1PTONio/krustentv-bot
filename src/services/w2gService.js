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

export function createW2GService({ apiKey = '', roomId = '', dryRun = false, fetchImpl = fetch, logger = console } = {}) {
  const queue = createSimpleQueue();
  const jobs = new Map();

  async function createPushJob(items, idempotencyKey) {
    if (!idempotencyKey) {
      throw new Error('idempotencyKey is required');
    }

    const payloadHash = hashPayload(items || []);
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
      idempotencyKey,
      payloadHash,
      status: 'pending',
      items: (items || []).map((item, index) => ({ id: `${idempotencyKey}-${index}`, item, status: 'pending' })),
      createdAt: new Date().toISOString()
    };
    jobs.set(job.id, job);
    return job;
  }

  async function pushVideosToW2G(items, options = {}) {
    if (!items || items.length === 0) {
      throw new W2GServiceError('No videos to push');
    }

    const idempotencyKey = options.idempotencyKey || `push-${Date.now()}`;
    const job = await createPushJob(items, idempotencyKey);
    if (job.status === 'succeeded' && job.result) {
      return { job, result: job.result };
    }

    return queue.run(async () => {
      if (dryRun) {
        const result = { success: true, dryRun: true, jobId: job.id };
        job.status = 'succeeded';
        job.result = result;
        return { job, result };
      }

      const response = await fetchImpl('https://example.test', {
        method: 'POST',
        body: JSON.stringify(items)
      });
      const text = await response.text();
      job.status = 'succeeded';
      job.result = { success: true, body: text };
      return { job, result: job.result };
    });
  }

  return {
    createPushJob,
    pushVideosToW2G
  };
}
