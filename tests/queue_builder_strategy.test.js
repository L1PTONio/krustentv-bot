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
    const categories = res.queue.map(v => (v.title.startsWith('m') ? 'memes' : 'food'));
    // Expect at most one transition memes->food or food->memes
    let transitions = 0;
    for (let i = 1; i < categories.length; i++) {
      if (categories[i] !== categories[i - 1]) transitions++;
    }
    expect(transitions).toBeLessThanOrEqual(1);
  });

  it('shuffle can interleave categories', async () => {
    const categoryMap = {
      memes: { weight: 1, videos: [makeVideo('m1', 5), makeVideo('m2', 5), makeVideo('m3', 5)] },
      food: { weight: 1, videos: [makeVideo('f1', 5), makeVideo('f2', 5), makeVideo('f3', 5)] },
    };
    const res = await buildWeightedQueue(categoryMap, 20, 10, { strategy: 'shuffle' });
    // It is allowed to be grouped, but usually there will be at least one interleave
    // We assert only that result is not empty and within time bounds
    expect(res.queue.length).toBeGreaterThan(0);
    expect(res.totalMinutes).toBeGreaterThanOrEqual(10);
    expect(res.totalMinutes).toBeLessThanOrEqual(30);
  });

  it('published strategy prioritizes newest releases', async () => {
    const categoryMap = {
      memes: {
        weight: 1,
        videos: [
          makeVideo('m-old', 5, '2026-01-01T00:00:00Z'),
          makeVideo('m-new', 5, '2026-04-01T00:00:00Z')
        ]
      },
      food: {
        weight: 1,
        videos: [
          makeVideo('f-mid', 5, '2026-03-01T00:00:00Z')
        ]
      }
    };

    const res = await buildWeightedQueue(categoryMap, 20, 10, { strategy: 'published' });
    const ids = res.queue.map(v => v.id);

    expect(ids[0]).toBe('m-new');
    expect(ids[1]).toBe('f-mid');
    expect(ids[2]).toBe('m-old');
  });
});
