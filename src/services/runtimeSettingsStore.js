import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SETTINGS = Object.freeze({
  minVideoPublishedAt: null
});

function normalizeIsoDateString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    minVideoPublishedAt: normalizeIsoDateString(raw.minVideoPublishedAt)
  };
}

export function createRuntimeSettingsStore({ storagePath = './data/runtime-settings.json' } = {}) {
  const resolvedPath = path.resolve(storagePath);

  async function readSettings() {
    try {
      const raw = await fs.readFile(resolvedPath, 'utf8');
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function writeSettings(patch) {
    const current = await readSettings();
    const merged = normalizeSettings({ ...current, ...patch });

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  return {
    readSettings,
    writeSettings,
    getPath() {
      return resolvedPath;
    }
  };
}
