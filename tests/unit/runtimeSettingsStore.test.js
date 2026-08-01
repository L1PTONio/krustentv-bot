import { describe, expect, it, afterEach } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeSettingsStore } from '../../src/services/runtimeSettingsStore.js';

const tempPaths = [];

afterEach(async () => {
  for (const filePath of tempPaths.splice(0)) {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true }).catch(() => {});
  }
});

function createTempStorePath() {
  const dir = path.join(os.tmpdir(), `krustentv-runtime-settings-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const filePath = path.join(dir, 'runtime-settings.json');
  tempPaths.push(filePath);
  return filePath;
}

describe('runtimeSettingsStore', () => {
  it('returns defaults when no settings file exists', async () => {
    const store = createRuntimeSettingsStore({ storagePath: createTempStorePath() });
    const settings = await store.readSettings();

    expect(settings).toEqual({ minVideoPublishedAt: null });
  });

  it('persists and normalizes minVideoPublishedAt', async () => {
    const store = createRuntimeSettingsStore({ storagePath: createTempStorePath() });
    const updated = await store.writeSettings({ minVideoPublishedAt: '2026-01-01T00:00:00Z' });

    expect(updated.minVideoPublishedAt).toBe('2026-01-01T00:00:00.000Z');

    const reread = await store.readSettings();
    expect(reread.minVideoPublishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('treats invalid values as disabled', async () => {
    const store = createRuntimeSettingsStore({ storagePath: createTempStorePath() });
    const updated = await store.writeSettings({ minVideoPublishedAt: 'not-a-date' });

    expect(updated.minVideoPublishedAt).toBeNull();
  });
});
