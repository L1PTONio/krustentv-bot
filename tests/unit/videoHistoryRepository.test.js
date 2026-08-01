import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../../src/db/database.js';
import { createVideoHistoryRepository } from '../../src/repositories/videoHistoryRepository.js';

describe('TD-006 video history repository', () => {
  it('imports legacy history data and filters unseen videos by cutoff', async () => {
    const filePath = path.join(os.tmpdir(), `history-repo-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    const db = openDatabase(filePath);
    const repository = createVideoHistoryRepository({ db });

    await repository.importLegacyHistory();

    repository.markVideoSeen('seen-video');
    expect(repository.isVideoSeen('seen-video')).toBe(true);

    const videos = [
      { id: 'seen-video', publishedAt: '2026-01-02T00:00:00Z' },
      { id: 'new-video', publishedAt: '2026-01-02T00:00:00Z' },
      { id: 'old-video', publishedAt: '2025-01-02T00:00:00Z' }
    ];

    const filtered = repository.filterUnseenVideos(videos);
    expect(filtered).toEqual([{ id: 'new-video', publishedAt: '2026-01-02T00:00:00Z' }]);

    db.close();
    fs.unlinkSync(filePath);
  });
});
