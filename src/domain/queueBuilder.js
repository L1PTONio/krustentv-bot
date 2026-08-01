function isFiniteInteger(value) {
  return Number.isInteger(value) && Number.isFinite(value);
}

function normalizeCandidate(candidate, index) {
  const id = candidate?.id;
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid candidate id at index ${index}`);
  }

  const durationSeconds = Number(candidate?.durationSeconds ?? candidate?.duration ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid durationSeconds for candidate ${id}`);
  }

  return {
    id,
    sourceId: candidate?.sourceId || null,
    title: candidate?.title || id,
    durationSeconds,
    publishedAt: candidate?.publishedAt || null,
    category: candidate?.category || null,
    channelId: candidate?.channelId || null
  };
}

function createSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function shuffleArray(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    const tmp = result[index];
    result[index] = result[pick];
    result[pick] = tmp;
  }
  return result;
}

function getPublishedAtTimestamp(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  return date.getTime();
}

function buildQueue(candidates, options = {}) {
  const targetSeconds = Number(options.targetSeconds ?? 0);
  const toleranceSeconds = Number(options.toleranceSeconds ?? 0);
  const strategy = options.strategy || 'shuffle';
  const seed = options.seed ?? 0;
  const allowSingleOversize = Boolean(options.allowSingleOversize);

  if (!isFiniteInteger(targetSeconds) || targetSeconds <= 0) {
    throw new Error('targetSeconds must be a positive integer');
  }

  if (!isFiniteInteger(toleranceSeconds) || toleranceSeconds < 0) {
    throw new Error('toleranceSeconds must be a non-negative integer');
  }

  if (!['shuffle', 'category_blocks', 'published', 'published_newest', 'published_oldest'].includes(strategy)) {
    throw new Error('Unsupported strategy');
  }

  const normalizedCandidates = [];
  const rejectedCandidates = [];
  const seenIds = new Set();

  for (const [index, candidate] of (candidates || []).entries()) {
    try {
      const normalized = normalizeCandidate(candidate, index);
      if (seenIds.has(normalized.id)) {
        rejectedCandidates.push({ candidate: normalized, reason: 'duplicate_id' });
        continue;
      }
      seenIds.add(normalized.id);
      normalizedCandidates.push(normalized);
    } catch (error) {
      rejectedCandidates.push({ candidate, reason: error.message });
    }
  }

  const random = createSeededRandom(seed);
  let orderedCandidates = normalizedCandidates;
  if (strategy === 'shuffle') {
    orderedCandidates = shuffleArray(normalizedCandidates, random);
  } else if (strategy === 'published' || strategy === 'published_newest') {
    orderedCandidates = [...normalizedCandidates].sort((a, b) => {
      const delta = getPublishedAtTimestamp(b.publishedAt) - getPublishedAtTimestamp(a.publishedAt);
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });
  } else if (strategy === 'published_oldest') {
    orderedCandidates = [...normalizedCandidates].sort((a, b) => {
      const delta = getPublishedAtTimestamp(a.publishedAt) - getPublishedAtTimestamp(b.publishedAt);
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });
  }
  const queue = [];
  let totalSeconds = 0;

  for (const candidate of orderedCandidates) {
    if (candidate.durationSeconds > targetSeconds + toleranceSeconds) {
      rejectedCandidates.push({ candidate, reason: 'oversize' });
      continue;
    }

    if (totalSeconds + candidate.durationSeconds <= targetSeconds + toleranceSeconds) {
      queue.push(candidate);
      totalSeconds += candidate.durationSeconds;
      continue;
    }

    if (queue.length === 0 && allowSingleOversize && candidate.durationSeconds <= targetSeconds + toleranceSeconds) {
      queue.push(candidate);
      totalSeconds += candidate.durationSeconds;
      continue;
    }

    if (queue.length > 0 && totalSeconds < targetSeconds && Math.abs((totalSeconds + candidate.durationSeconds) - targetSeconds) <= toleranceSeconds) {
      queue.push(candidate);
      totalSeconds += candidate.durationSeconds;
      continue;
    }

    rejectedCandidates.push({ candidate, reason: 'fit_not_possible' });
  }

  const deltaSeconds = totalSeconds - targetSeconds;
  const withinTolerance = Math.abs(deltaSeconds) <= toleranceSeconds;

  return {
    queue,
    totalSeconds,
    targetSeconds,
    toleranceSeconds,
    deltaSeconds,
    withinTolerance,
    rejectedCandidates,
    strategy,
    seed
  };
}

function buildWeightedQueue(categoryMap, options = {}) {
  if (!categoryMap || typeof categoryMap !== 'object') {
    throw new Error('categoryMap must be an object');
  }

  const entries = Object.entries(categoryMap).map(([category, definition]) => {
    if (typeof definition === 'number') {
      return { category, weight: definition, videos: [] };
    }

    if (!definition || typeof definition !== 'object') {
      throw new Error(`Invalid category definition for ${category}`);
    }

    const weight = Number(definition.weight ?? 1);
    if (!Number.isInteger(weight) || weight < 1 || weight > 10) {
      throw new Error(`Invalid category weight for ${category}`);
    }

    const videos = Array.isArray(definition.videos) ? definition.videos : [];
    return {
      category,
      weight,
      videos: videos.map((video, index) => ({
        id: video?.id || `${category}-${index}`,
        title: video?.title || category,
        durationSeconds: Number(video?.durationSeconds ?? video?.duration ?? 60),
        publishedAt: video?.publishedAt || null,
        category,
        channelId: video?.channelId || null
      }))
    };
  });

  const resolvedStrategy = options.strategy || 'category_blocks';
  const candidates = [];
  const weightedSchedule = [];
  const queues = new Map();

  for (const entry of entries) {
    const videos = entry.videos.length > 0
      ? entry.videos.map((video, index) => ({
        ...video,
        sourceId: video.id,
        id: `${video.id}-${entry.category}-${index}`,
        category: entry.category
      }))
      : Array.from({ length: entry.weight }, (_, index) => ({
        id: `${entry.category}-default-${index}`,
        title: entry.category,
        durationSeconds: 60,
        category: entry.category,
        publishedAt: null,
        channelId: null
      }));

    queues.set(entry.category, videos);
    for (let i = 0; i < entry.weight; i += 1) {
      weightedSchedule.push(entry.category);
    }
  }

  if (resolvedStrategy === 'category_blocks') {
    for (const entry of entries) {
      const queue = queues.get(entry.category) || [];
      for (const video of queue) {
        candidates.push(video);
      }
    }
  } else {
    let hasRemaining = Array.from(queues.values()).some(queue => queue.length > 0);
    while (hasRemaining) {
      let pickedInRound = false;

      for (const categoryName of weightedSchedule) {
        const queue = queues.get(categoryName);
        if (!queue || queue.length === 0) {
          continue;
        }

        candidates.push(queue.shift());
        pickedInRound = true;
      }

      if (!pickedInRound) {
        break;
      }

      hasRemaining = Array.from(queues.values()).some(queue => queue.length > 0);
    }
  }

  const built = buildQueue(candidates, {
    ...options,
    strategy: resolvedStrategy
  });

  return {
    ...built,
    queue: built.queue.map(video => ({
      ...video,
      id: video.sourceId || video.id
    }))
  };
}

function calculateTotalWatchtime(videos) {
  return (videos || []).reduce((sum, video) => sum + (Number(video?.durationSeconds) || 0), 0);
}

export { buildQueue, buildWeightedQueue, calculateTotalWatchtime };
export default { buildQueue, buildWeightedQueue, calculateTotalWatchtime };
