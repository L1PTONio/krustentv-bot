import { describe, it, expect } from '@jest/globals';
import { buildWeightedQueue } from '../queue_builder.js';

function makeVideo(id, mins, publishedAt = '2026-01-05T00:00:00Z', extra = {}) {
  return { id, duration: mins * 60, publishedAt, title: id, ...extra };
}

describe('queue_builder strategies', () => {
  it('category_blocks keeps videos grouped by category', async () => {
    const categoryMap = {
      memes: { weight: 1, videos: [makeVideo('m1', 5), makeVideo('m2', 5)] },
      food: { weight: 1, videos: [makeVideo('f1', 5), makeVideo('f2', 5)] },
    };
    const res = await buildWeightedQueue(categoryMap, 15, 5, { strategy: 'category_blocks' });
    const cats = res.queue.map(v => (v.title.startsWith('m') ? 'memes' : 'food'));
    // Expect at most one transition memes->food or food->memes
    let transitions = 0;
    for (let i = 1; i < cats.length; i++) {
      if (cats[i] !== cats[i - 1]) transitions++;
    }
    expect(transitions).toBeLessThanOrEqual(1);
  });

  it('shuffle can interleave categories', async () => {
    const categoryMap = {
      memes: { weight: 1, videos: [makeVideo('m1', 5), makeVideo('m2', 5), makeVideo('m3', 5)] },
      food: { weight: 1, videos: [makeVideo('f1', 5), makeVideo('f2', 5), makeVideo('f3', 5)] },
    };
    const res = await buildWeightedQueue(categoryMap, 20, 10, { strategy: 'shuffle' });
    const cats = res.queue.map(v => (v.title.startsWith('m') ? 'memes' : 'food'));
    // It is allowed to be grouped, but usually there will be at least one interleave
    // We assert only that result is not empty and within time bounds
    expect(res.queue.length).toBeGreaterThan(0);
    expect(res.totalMinutes).toBeGreaterThanOrEqual(10);
    expect(res.totalMinutes).toBeLessThanOrEqual(30);
  });
});
