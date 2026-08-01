import { buildQueue as buildPureQueue, buildWeightedQueue as buildPureWeightedQueue, calculateTotalWatchtime as calculatePureWatchtime } from './src/domain/queueBuilder.js';

/**
 * Baut eine Queue basierend auf Watchtime und Toleranz.
 * Die alte Signatur bleibt für bestehende Aufrufer erhalten.
 */
export async function buildQueue(videos, targetMinutes, toleranceMinutes = 5, options = {}) {
  if (videos && typeof videos === 'object' && !Array.isArray(videos)) {
    return buildWeightedQueue(videos, targetMinutes, toleranceMinutes, options);
  }

  const result = buildPureQueue((videos || []).map(video => ({
    ...video,
    durationSeconds: Number(video.durationSeconds ?? video.duration ?? 0)
  })), {
    targetSeconds: targetMinutes * 60,
    toleranceSeconds: toleranceMinutes * 60,
    strategy: options.strategy || 'shuffle',
    seed: options.seed ?? 0,
    allowSingleOversize: Boolean(options.allowSingleOversize)
  });

  return {
    queue: result.queue.map(video => ({ ...video, duration: video.durationSeconds })),
    totalSeconds: result.totalSeconds,
    totalMinutes: Math.round(result.totalSeconds / 60),
    targetMinutes,
    toleranceMinutes,
    deltaSeconds: result.deltaSeconds,
    withinTolerance: result.withinTolerance,
    rejectedCandidates: result.rejectedCandidates,
    strategy: result.strategy,
    seed: result.seed
  };
}

/**
 * Berechnet Gesamt-Watchtime einer Video-Liste.
 */
export function calculateTotalWatchtime(videos) {
  const result = calculatePureWatchtime(videos || []);
  return {
    seconds: result,
    minutes: Math.round(result / 60)
  };
}

/**
 * Builds a weighted queue from a map of categories.
 */
export async function buildWeightedQueue(categoryMap, targetMinutes, toleranceMinutes = 5, options = {}) {
  const result = buildPureWeightedQueue(
    Object.fromEntries(Object.entries(categoryMap || {}).map(([name, data]) => [name, data])),
    {
      targetSeconds: targetMinutes * 60,
      toleranceSeconds: toleranceMinutes * 60,
      strategy: options.strategy || 'shuffle',
      seed: options.seed ?? 0,
      allowSingleOversize: Boolean(options.allowSingleOversize)
    }
  );

  return {
    queue: result.queue.map(video => ({ ...video, duration: video.durationSeconds })),
    totalSeconds: result.totalSeconds,
    totalMinutes: Math.round(result.totalSeconds / 60),
    targetMinutes,
    toleranceMinutes,
    deltaSeconds: result.deltaSeconds,
    withinTolerance: result.withinTolerance,
    rejectedCandidates: result.rejectedCandidates,
    strategy: result.strategy,
    seed: result.seed
  };
}

