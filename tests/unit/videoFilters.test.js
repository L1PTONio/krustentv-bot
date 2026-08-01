import { describe, expect, it } from '@jest/globals';
import { filterVideosByMinDuration } from '../../src/utils/videoFilters.js';

describe('videoFilters', () => {
  it('keeps only videos with at least 60 seconds', () => {
    const input = [
      { id: 'a', duration: 59 },
      { id: 'b', duration: 60 },
      { id: 'c', duration: 125 },
      { id: 'd', duration: 0 },
      { id: 'e' }
    ];

    const result = filterVideosByMinDuration(input, 60);
    expect(result.videos.map(v => v.id)).toEqual(['b', 'c']);
    expect(result.removedCount).toBe(3);
  });

  it('supports durationSeconds fallback and custom threshold', () => {
    const input = [
      { id: 'x', durationSeconds: 20 },
      { id: 'y', durationSeconds: 30 },
      { id: 'z', durationSeconds: 31 }
    ];

    const result = filterVideosByMinDuration(input, 30);
    expect(result.videos.map(v => v.id)).toEqual(['y', 'z']);
    expect(result.removedCount).toBe(1);
  });

  it('can exclude likely shorts by title marker regardless of duration', () => {
    const input = [
      { id: 'short-1', title: 'The Darkest Web #shorts', duration: 120 },
      { id: 'short-2', title: 'SHORTS: quick clip', duration: 300 },
      { id: 'regular-1', title: 'Long documentary episode', duration: 120 }
    ];

    const result = filterVideosByMinDuration(input, 60, { excludeLikelyShorts: true });
    expect(result.videos.map(v => v.id)).toEqual(['regular-1']);
    expect(result.removedCount).toBe(2);
  });
});
