import { describe, expect, it } from '@jest/globals';
import { buildQueue, buildWeightedQueue, calculateTotalWatchtime } from '../../src/domain/queueBuilder.js';

describe('TD-008 queue builder', () => {
  it('picks a fitting queue and records rejected candidates', () => {
    const result = buildQueue([
      { id: 'a', durationSeconds: 60, title: 'A' },
      { id: 'b', durationSeconds: 240, title: 'B' },
      { id: 'c', durationSeconds: 90, title: 'C' }
    ], { targetSeconds: 180, toleranceSeconds: 30, strategy: 'shuffle', seed: 1 });

    expect(result.queue.length).toBeGreaterThanOrEqual(1);
    expect(result.totalSeconds).toBeLessThanOrEqual(210);
    expect(result.rejectedCandidates.some(item => item.reason === 'oversize')).toBe(true);
  });

  it('is deterministic for the same seed and rejects invalid candidates', () => {
    const first = buildQueue([
      { id: 'a', durationSeconds: 60 },
      { id: 'b', durationSeconds: 90 },
      { id: 'c', durationSeconds: 0 },
      { id: 'd', durationSeconds: 30 }
    ], { targetSeconds: 120, toleranceSeconds: 0, strategy: 'shuffle', seed: 42 });

    const second = buildQueue([
      { id: 'a', durationSeconds: 60 },
      { id: 'b', durationSeconds: 90 },
      { id: 'c', durationSeconds: 0 },
      { id: 'd', durationSeconds: 30 }
    ], { targetSeconds: 120, toleranceSeconds: 0, strategy: 'shuffle', seed: 42 });

    expect(first.queue.map(item => item.id)).toEqual(second.queue.map(item => item.id));
    expect(first.rejectedCandidates.some(item => item.reason.includes('Invalid durationSeconds'))).toBe(true);
  });

  it('builds a weighted queue and computes watchtime', () => {
    const result = buildWeightedQueue({ gaming: 2, music: 1 }, { targetSeconds: 180, toleranceSeconds: 0, strategy: 'category_blocks' });
    expect(result.queue).toHaveLength(3);
    expect(calculateTotalWatchtime(result.queue)).toBe(180);
  });
});
