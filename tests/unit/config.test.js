import { beforeEach, describe, it, expect } from '@jest/globals';
import { ConfigValidationError, loadConfig, redactConfig } from '../../src/config/config.js';
import { createYouTubeService, configureYouTubeService, resetYouTubeService, getChannelInfo as getConfiguredChannelInfo } from '../../youtube.js';
import { createW2GService, configureW2GService, resetW2GService, pushVideosToW2G as pushConfiguredVideosToW2G } from '../../w2g_push.js';

function baseEnv(overrides = {}) {
  return {
    DISCORD_TOKEN: 'discord-token',
    DISCORD_CLIENT_ID: '123456789012345678',
    YOUTUBE_API_KEY: 'youtube-key',
    ...overrides
  };
}

describe('TD-002 config module', () => {
  beforeEach(() => {
    resetYouTubeService();
    resetW2GService();
  });
  it('builds a valid live config with defaults', () => {
    const config = loadConfig(baseEnv({ W2G_DRY_RUN: 'true' }));

    expect(config.nodeEnv).toBe('development');
    expect(config.discord).toEqual({
      token: 'discord-token',
      clientId: '123456789012345678',
      guildId: undefined
    });
    expect(config.youtube).toEqual({
      apiKey: 'youtube-key',
      requestTimeoutMs: 10000
    });
    expect(config.w2g.dryRun).toBe(true);
    expect(config.w2g.forceLive).toBe(false);
    expect(config.database.path).toBe('data/krustentv.sqlite');
    expect(config.video.minPublishedAt).toBeNull();
    expect(config.admin.userIds).toEqual([]);
    expect(config.sessions.ttlMinutes).toBe(60);
  });

  it('collects multiple configuration errors', () => {
    try {
      loadConfig({ DISCORD_CLIENT_ID: '123456789012345678', YOUTUBE_API_KEY: 'youtube-key' });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'discord.token' }),
        expect.objectContaining({ field: 'w2g.apiKey' }),
        expect.objectContaining({ field: 'w2g.roomId' })
      ]));
      expect(error.message).toContain('discord.token');
      expect(error.message).toContain('w2g.apiKey');
    }
  });

  it('accepts dry-run without W2G credentials and normalizes force-live', () => {
    const dryRunConfig = loadConfig(baseEnv({ W2G_DRY_RUN: 'true' }));
    expect(dryRunConfig.w2g.dryRun).toBe(true);

    const forceLiveConfig = loadConfig(baseEnv({ W2G_FORCE_LIVE: 'true', W2G_DRY_RUN: 'true', W2G_API_KEY: 'abc', W2G_ROOM_ID: 'room123' }));
    expect(forceLiveConfig.w2g.forceLive).toBe(true);
    expect(forceLiveConfig.w2g.dryRun).toBe(false);
  });

  it('parses supported boolean values case-insensitively', () => {
    const trueValues = ['true', ' TRUE ', '1', 'yes', 'on'];
    const falseValues = ['false', ' FALSE ', '0', 'no', 'off'];

    const commonOverrides = { W2G_API_KEY: 'abc', W2G_ROOM_ID: 'room123' };

    for (const value of trueValues) {
      expect(loadConfig(baseEnv({ ...commonOverrides, W2G_DRY_RUN: value })).w2g.dryRun).toBe(true);
    }

    for (const value of falseValues) {
      expect(loadConfig(baseEnv({ ...commonOverrides, W2G_DRY_RUN: value })).w2g.dryRun).toBe(false);
    }

    expect(() => loadConfig(baseEnv({ ...commonOverrides, W2G_DRY_RUN: 'maybe' }))).toThrow(ConfigValidationError);
  });

  it('parses positive integers and rejects invalid values', () => {
    expect(loadConfig(baseEnv({ YOUTUBE_REQUEST_TIMEOUT_MS: '15000', W2G_DRY_RUN: 'true' })).youtube.requestTimeoutMs).toBe(15000);
    expect(() => loadConfig(baseEnv({ SESSION_TTL_MINUTES: '0', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
    expect(() => loadConfig(baseEnv({ YOUTUBE_REQUEST_TIMEOUT_MS: '-1', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
    expect(() => loadConfig(baseEnv({ YOUTUBE_REQUEST_TIMEOUT_MS: '1.5', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
    expect(() => loadConfig(baseEnv({ YOUTUBE_REQUEST_TIMEOUT_MS: 'abc', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
    expect(() => loadConfig(baseEnv({ YOUTUBE_REQUEST_TIMEOUT_MS: '999999999999', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
  });

  it('parses CSV lists with trimming, deduplication and validation', () => {
    const config = loadConfig(baseEnv({ ADMIN_USER_IDS: ' 1, 2,2, 3 ', ADMIN_ROLE_IDS: ' 5 , , 6 ', W2G_DRY_RUN: 'true' }));
    expect(config.admin.userIds).toEqual(['1', '2', '3']);
    expect(config.admin.roleIds).toEqual(['5', '6']);
    expect(Object.isFrozen(config.admin.userIds)).toBe(true);
    expect(Object.isFrozen(config.admin.roleIds)).toBe(true);

    expect(() => loadConfig(baseEnv({ ADMIN_USER_IDS: 'abc', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
  });

  it('accepts valid and empty room IDs depending on mode', () => {
    expect(loadConfig(baseEnv({ W2G_ROOM_ID: 'abc123', W2G_DRY_RUN: 'true' })).w2g.roomId).toBe('abc123');
    expect(loadConfig(baseEnv({ W2G_ROOM_ID: 'abc-123_def', W2G_DRY_RUN: 'true' })).w2g.roomId).toBe('abc-123_def');
    expect(() => loadConfig(baseEnv({ W2G_ROOM_ID: 'abc 123', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
    expect(() => loadConfig(baseEnv({ W2G_DRY_RUN: 'false', W2G_API_KEY: 'abc', W2G_ROOM_ID: 'a/b' }))).toThrow(ConfigValidationError);
  });

  it('parses dates and returns null for empty optional dates', () => {
    const config = loadConfig(baseEnv({ MIN_VIDEO_PUBLISHED_AT: '2026-01-01T00:00:00Z', W2G_DRY_RUN: 'true' }));
    expect(config.video.minPublishedAt).toBeInstanceOf(Date);
    const empty = loadConfig(baseEnv({ MIN_VIDEO_PUBLISHED_AT: '', W2G_DRY_RUN: 'true' }));
    expect(empty.video.minPublishedAt).toBeNull();
    expect(() => loadConfig(baseEnv({ MIN_VIDEO_PUBLISHED_AT: 'not-a-date', W2G_DRY_RUN: 'true' }))).toThrow(ConfigValidationError);
  });

  it('keeps independent loadConfig calls isolated and does not mutate env inputs', () => {
    const firstEnv = { DISCORD_TOKEN: 'token-a', DISCORD_CLIENT_ID: '111', YOUTUBE_API_KEY: 'yt-a', W2G_DRY_RUN: 'true' };
    const secondEnv = { DISCORD_TOKEN: 'token-b', DISCORD_CLIENT_ID: '222', YOUTUBE_API_KEY: 'yt-b', W2G_DRY_RUN: 'false', W2G_API_KEY: 'abc', W2G_ROOM_ID: 'room123' };

    const firstConfig = loadConfig(firstEnv);
    const secondConfig = loadConfig(secondEnv);

    expect(firstConfig.discord.token).toBe('token-a');
    expect(secondConfig.discord.token).toBe('token-b');
    expect(firstEnv.DISCORD_TOKEN).toBe('token-a');
    expect(secondEnv.DISCORD_TOKEN).toBe('token-b');
    expect(firstConfig.w2g.dryRun).toBe(true);
    expect(secondConfig.w2g.dryRun).toBe(false);
  });

  it('redacts secrets from configuration output', () => {
    const config = loadConfig(baseEnv({
      DISCORD_TOKEN: 'discord-secret-do-not-leak',
      YOUTUBE_API_KEY: 'youtube-secret-do-not-leak',
      W2G_API_KEY: 'w2g-secret-do-not-leak',
      W2G_ROOM_ID: 'room123',
      W2G_DRY_RUN: 'true'
    }));

    const redacted = JSON.stringify(redactConfig(config));
    expect(redacted).not.toContain('discord-secret-do-not-leak');
    expect(redacted).not.toContain('youtube-secret-do-not-leak');
    expect(redacted).not.toContain('w2g-secret-do-not-leak');
    expect(redacted).toContain('tokenConfigured');
    expect(redacted).toContain('apiKeyConfigured');
  });

  it('uses injected fetch implementations in services', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ items: [{ id: 'UC123', snippet: { title: 'Test' } }] }),
      text: async () => ''
    });

    const youtubeService = createYouTubeService({ apiKey: 'abc', fetchImpl });
    const result = await youtubeService.getChannelInfo('UC123');
    expect(result).toEqual({ id: 'UC123', name: 'Test' });

    const w2gService = createW2GService({ apiKey: 'abc', roomId: 'room123', dryRun: true, fetchImpl });
    const response = await w2gService.pushVideosToW2G([{ url: 'https://example.com', title: 'Demo' }]);
    expect(response[0].success).toBe(true);
  });

  it('uses defaults for empty optional strings', () => {
    const config = loadConfig(baseEnv({ NODE_ENV: '', DATABASE_PATH: '', W2G_DRY_RUN: 'true' }));
    expect(config.nodeEnv).toBe('development');
    expect(config.database.path).toBe('data/krustentv.sqlite');
  });

  it('keeps configured default services isolated from env changes', async () => {
    const youtubeFetchImpl = async (_url) => ({
      ok: true,
      json: async () => ({ items: [{ id: 'UC123', snippet: { title: 'Configured YouTube' } }] }),
      text: async () => ''
    });
    configureYouTubeService({ apiKey: 'configured-youtube', fetchImpl: youtubeFetchImpl });

    const w2gFetchImpl = async (_url) => ({ ok: true, text: async () => '{}' });
    configureW2GService({ apiKey: 'configured-w2g', roomId: 'room123', dryRun: true, fetchImpl: w2gFetchImpl });

    const youtubeResult = await getConfiguredChannelInfo('UC123');
    expect(youtubeResult).toEqual({ id: 'UC123', name: 'Configured YouTube' });

    const w2gResult = await pushConfiguredVideosToW2G([{ url: 'https://example.com', title: 'Demo' }]);
    expect(w2gResult[0].success).toBe(true);
  });

  it('keeps two YouTube services isolated from each other', async () => {
    const firstService = createYouTubeService({ apiKey: 'first-key', fetchImpl: async () => ({ ok: true, json: async () => ({ items: [{ id: 'UC123', snippet: { title: 'First' } }] }), text: async () => '' }) });
    const secondService = createYouTubeService({ apiKey: 'second-key', fetchImpl: async () => ({ ok: true, json: async () => ({ items: [{ id: 'UC123', snippet: { title: 'Second' } }] }), text: async () => '' }) });

    const firstResult = await firstService.getChannelInfo('UC123');
    const secondResult = await secondService.getChannelInfo('UC123');

    expect(firstResult).toEqual({ id: 'UC123', name: 'First' });
    expect(secondResult).toEqual({ id: 'UC123', name: 'Second' });
  });

  it('keeps two W2G services isolated from each other', async () => {
    const firstService = createW2GService({ apiKey: 'first-key', roomId: 'room1', dryRun: false, fetchImpl: async () => ({ ok: true, text: async () => '{}' }) });
    const secondService = createW2GService({ apiKey: 'second-key', roomId: 'room2', dryRun: false, fetchImpl: async () => ({ ok: true, text: async () => '{}' }) });

    const firstResult = await firstService.pushVideosToW2G([{ url: 'https://example.com/1', title: 'First' }]);
    const secondResult = await secondService.pushVideosToW2G([{ url: 'https://example.com/2', title: 'Second' }]);

    expect(firstResult[0].success).toBe(true);
    expect(secondResult[0].success).toBe(true);
  });

  it('does not read process.env when the wrapper is used without a configured service', () => {
    process.env.YOUTUBE_API_KEY = 'should-not-be-used';
    expect(() => getConfiguredChannelInfo('UC123')).toThrow('YouTube service is not configured');
  });
});
