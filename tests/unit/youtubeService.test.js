import { describe, expect, it } from '@jest/globals';
import { createSafeYouTubeService, ExternalServiceError } from '../../src/services/youtubeService.js';

describe('TD-007 youtube service safety', () => {
  it('batch-loads metadata and reports missing ids', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        items: [{
          id: 'video-1',
          snippet: { title: 'Test', channelId: 'channel-1', channelTitle: 'Channel', publishedAt: '2026-01-01T00:00:00Z' },
          contentDetails: { duration: 'PT3M20S' },
          liveStreamingDetails: {},
          status: { uploadStatus: 'processed' }
        }]
      })
    });

    const service = createSafeYouTubeService({ apiKey: 'abc', fetchImpl });
    const result = await service.getVideoDetailsBatch(['video-1', 'video-2']);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ videoId: 'video-1', title: 'Test', durationSeconds: 200, liveStatus: 'archived' });
    expect(result.missing).toEqual(['video-2']);
  });

  it('wraps timeout failures in ExternalServiceError', async () => {
    const fetchImpl = async () => {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    };

    const service = createSafeYouTubeService({ apiKey: 'abc', fetchImpl, requestTimeoutMs: 1 });
    await expect(service.getVideoDetailsBatch(['video-1'])).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
