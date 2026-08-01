import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HISTORY_FILE = join(__dirname, 'w2g_history.json');
const MAX_PUSH_HISTORY_ENTRIES = 1000;

function createInitialHistory() {
  return {
    seen: {},
    lastCacheReset: null,
    pushed: []
  };
}

function normalizeSeenEntry(entry) {
  if (entry === true) {
    return { seen: true };
  }
  if (entry && typeof entry === 'object') {
    return {
      seen: entry.seen !== false,
      title: typeof entry.title === 'string' ? entry.title : undefined,
      publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt : undefined,
      pushedAt: typeof entry.pushedAt === 'string' ? entry.pushedAt : undefined
    };
  }
  return { seen: false };
}

function normalizePushedEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter(item => item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim() !== '')
    .map(item => ({
      id: item.id,
      title: typeof item.title === 'string' ? item.title : '',
      publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
      pushedAt: typeof item.pushedAt === 'string' ? item.pushedAt : null,
      category: typeof item.category === 'string' ? item.category : null
    }));
}

function normalizeHistory(rawHistory) {
  const history = rawHistory && typeof rawHistory === 'object'
    ? rawHistory
    : createInitialHistory();

  const seenSource = history.seen && typeof history.seen === 'object' ? history.seen : {};
  const normalizedSeen = {};
  for (const [videoId, value] of Object.entries(seenSource)) {
    normalizedSeen[videoId] = normalizeSeenEntry(value);
  }

  const normalizedPushed = normalizePushedEntries(history.pushed);

  return {
    seen: normalizedSeen,
    lastCacheReset: typeof history.lastCacheReset === 'string' ? history.lastCacheReset : null,
    pushed: normalizedPushed
  };
}

/**
 * Lädt die History-Datei oder erstellt eine neue
 */
async function loadHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return normalizeHistory(JSON.parse(data));
  } catch {
    // Datei existiert nicht, erstelle neue Struktur
    return createInitialHistory();
  }
}

/**
 * Speichert die History-Datei
 */
async function saveHistory(history) {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Prüft, ob ein Video bereits gesehen wurde
 */
export async function isVideoSeen(videoId) {
  const history = await loadHistory();
  return history.seen[videoId]?.seen === true;
}

/**
 * Markiert ein Video als gesehen
 */
export async function markVideoSeen(videoId) {
  const history = await loadHistory();
  history.seen[videoId] = { seen: true };
  await saveHistory(history);
}

/**
 * Markiert mehrere Videos als gesehen
 */
export async function markVideosSeen(videoIds) {
  const history = await loadHistory();
  for (const videoId of videoIds) {
    history.seen[videoId] = { seen: true };
  }
  await saveHistory(history);
}

/**
 * Speichert gepushte Videos inkl. Timestamps für Admin-History
 */
export async function markVideosPushed(videos) {
  const history = await loadHistory();
  const pushedAt = new Date().toISOString();

  for (const video of videos || []) {
    if (!video || typeof video.id !== 'string' || video.id.trim() === '') {
      continue;
    }

    const entry = {
      id: video.id,
      title: typeof video.title === 'string' ? video.title : '',
      publishedAt: typeof video.publishedAt === 'string' ? video.publishedAt : null,
      pushedAt,
      category: typeof video.category === 'string' ? video.category : null
    };

    history.seen[video.id] = {
      seen: true,
      title: entry.title || undefined,
      publishedAt: entry.publishedAt || undefined,
      pushedAt
    };

    history.pushed = history.pushed.filter(item => item.id !== video.id);
    history.pushed.unshift(entry);
  }

  if (history.pushed.length > MAX_PUSH_HISTORY_ENTRIES) {
    history.pushed = history.pushed.slice(0, MAX_PUSH_HISTORY_ENTRIES);
  }

  await saveHistory(history);
}

/**
 * Liefert die zuletzt gepushten Videos (neueste zuerst)
 */
export async function getRecentPushedVideos(limit = 20) {
  const history = await loadHistory();
  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 20;
  return history.pushed.slice(0, safeLimit);
}

/**
 * Liefert den letzten Push-Zeitpunkt für eine Kategorie oder null.
 */
export async function getLastPushedAtForCategory(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') {
    return null;
  }

  const history = await loadHistory();
  const match = history.pushed.find(entry => entry.category === categoryName && typeof entry.pushedAt === 'string');
  return match ? match.pushedAt : null;
}

/**
 * Löscht die Watch-/Push-History komplett (für Wartung/Test-Cleanup)
 */
export async function clearWatchHistory() {
  const history = await loadHistory();
  history.seen = {};
  history.pushed = [];
  history.lastCacheReset = null;
  await saveHistory(history);
}

/**
 * Prüft, ob der Cache heute noch gültig ist (bis 12:00 Uhr)
 */
export async function isCacheValid() {
  const history = await loadHistory();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const resetTime = new Date(today);
  resetTime.setHours(12, 0, 0, 0);

  // Wenn nach 12:00 Uhr, Cache ist ungültig
  if (now >= resetTime) {
    // Prüfe, ob heute schon zurückgesetzt wurde
    const lastReset = history.lastCacheReset 
      ? new Date(history.lastCacheReset) 
      : null;
    
    if (!lastReset || lastReset < resetTime) {
      // Cache zurücksetzen
      history.seen = {};
      history.lastCacheReset = now.toISOString();
      await saveHistory(history);
      return false;
    }
  }

  return true;
}

/**
 * Filtert Videos, die noch nicht gesehen wurden UND ab 01.01.2026 veröffentlicht wurden
 */
export async function filterUnseenVideos(videos, minPublishedAt = null) {
  const history = await loadHistory();
  const cutoffDate = minPublishedAt instanceof Date && !Number.isNaN(minPublishedAt.getTime())
    ? minPublishedAt
    : null;
  
  return videos.filter(video => {
    // Muss ungesehen sein
    if (history.seen[video.id]?.seen === true) return false;
    
    // Muss ab 01.01.2026 sein
    if (cutoffDate && video.publishedAt) {
      const publishDate = new Date(video.publishedAt);
      if (publishDate < cutoffDate) return false;
    }
    
    return true;
  });
}
