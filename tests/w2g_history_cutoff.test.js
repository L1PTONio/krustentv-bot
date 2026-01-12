import { describe, it, expect, beforeEach } from '@jest/globals';
import { filterUnseenVideos } from '../w2g_history.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyPath = path.join(__dirname, '..', 'w2g_history.json');

async function resetHistory() {
  const initial = { seen: {}, lastCacheReset: null };
  await fs.writeFile(historyPath, JSON.stringify(initial, null, 2), 'utf-8');
}

describe('w2g_history.filterUnseenVideos date cutoff', () => {
  beforeEach(async () => {
    await resetHistory();
  });

  it('keeps only videos published at or after 2026-01-01', async () => {
    const videos = [
      { id: 'old1', publishedAt: '2025-12-31T23:59:59Z' },
      { id: 'edge', publishedAt: '2026-01-01T00:00:00Z' },
      { id: 'new1', publishedAt: '2026-01-02T12:00:00Z' },
      { id: 'nodate' },
    ];

    const result = await filterUnseenVideos(videos);
    const ids = result.map(v => v.id);
    expect(ids).toContain('edge');
    expect(ids).toContain('new1');
    expect(ids).not.toContain('old1');
    // Without date should be allowed (treated as >= cutoff)
    expect(ids).toContain('nodate');
  });

  it('excludes seen videos regardless of date', async () => {
    // Mark one video as seen
    const data = JSON.parse(await fs.readFile(historyPath, 'utf-8'));
    data.seen['edge'] = true;
    await fs.writeFile(historyPath, JSON.stringify(data, null, 2), 'utf-8');

    const videos = [
      { id: 'edge', publishedAt: '2026-01-01T00:00:00Z' },
      { id: 'new1', publishedAt: '2026-01-02T12:00:00Z' },
    ];

    const result = await filterUnseenVideos(videos);
    const ids = result.map(v => v.id);
    expect(ids).not.toContain('edge');
    expect(ids).toContain('new1');
  });
});
