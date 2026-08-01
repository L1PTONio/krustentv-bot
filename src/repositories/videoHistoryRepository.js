import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, closeDatabase } from '../db/database.js';
import { createMigrationRunner } from '../db/migrationRunner.js';
import historyMigration from '../db/migrations/003_video_history_schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_HISTORY_FILE = path.resolve(__dirname, '../../w2g_history.json');

export function createVideoHistoryRepository({ db, migrationRunner = null } = {}) {
  const database = db || openDatabase();
  const runner = migrationRunner || createMigrationRunner({ db: database, migrations: [historyMigration] });
  runner.runMigrations([historyMigration]);

  function ensureHistoryState() {
    database.exec(`
      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = database.prepare('SELECT value FROM bot_state WHERE key = ?').get('history_state');
    if (!existing) {
      database.prepare('INSERT INTO bot_state (key, value) VALUES (?, ?)').run('history_state', JSON.stringify({ seen: {}, lastCacheReset: null }));
    }
  }

  function readHistory() {
    ensureHistoryState();
    const row = database.prepare('SELECT value FROM bot_state WHERE key = ?').get('history_state');
    return JSON.parse(row.value);
  }

  function writeHistory(history) {
    database.prepare('UPDATE bot_state SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(JSON.stringify(history), 'history_state');
  }

  function isVideoSeen(videoId) {
    const history = readHistory();
    return history.seen?.[videoId] === true;
  }

  function markVideoSeen(videoId) {
    const history = readHistory();
    history.seen = history.seen || {};
    history.seen[videoId] = true;
    writeHistory(history);
  }

  function markVideosSeen(videoIds) {
    const history = readHistory();
    history.seen = history.seen || {};
    for (const videoId of videoIds) {
      history.seen[videoId] = true;
    }
    writeHistory(history);
  }

  function isCacheValid(now = new Date()) {
    const history = readHistory();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const resetTime = new Date(today);
    resetTime.setHours(12, 0, 0, 0);

    if (now >= resetTime) {
      const lastReset = history.lastCacheReset ? new Date(history.lastCacheReset) : null;
      if (!lastReset || lastReset < resetTime) {
        history.seen = {};
        history.lastCacheReset = now.toISOString();
        writeHistory(history);
        return false;
      }
    }

    return true;
  }

  function filterUnseenVideos(videos, cutoffDate = new Date('2026-01-01T00:00:00Z')) {
    const history = readHistory();
    return videos.filter(video => {
      if (history.seen?.[video.id]) return false;
      if (video.publishedAt) {
        const publishDate = new Date(video.publishedAt);
        if (publishDate < cutoffDate) return false;
      }
      return true;
    });
  }

  async function importLegacyHistory() {
    try {
      const raw = await fs.readFile(LEGACY_HISTORY_FILE, 'utf8');
      const data = JSON.parse(raw);
      const history = {
        seen: data.seen || {},
        lastCacheReset: data.lastCacheReset || null
      };
      writeHistory(history);
    } catch {
      // ignore missing legacy data
    }
  }

  return {
    isVideoSeen,
    markVideoSeen,
    markVideosSeen,
    isCacheValid,
    filterUnseenVideos,
    importLegacyHistory,
    close() {
      if (db) {
        return;
      }
      closeDatabase(database);
    }
  };
}
