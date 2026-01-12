import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HISTORY_FILE = join(__dirname, 'w2g_history.json');

/**
 * Lädt die History-Datei oder erstellt eine neue
 */
async function loadHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Datei existiert nicht, erstelle neue Struktur
    return {
      seen: {},
      lastCacheReset: null
    };
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
  return history.seen[videoId] === true;
}

/**
 * Markiert ein Video als gesehen
 */
export async function markVideoSeen(videoId) {
  const history = await loadHistory();
  history.seen[videoId] = true;
  await saveHistory(history);
}

/**
 * Markiert mehrere Videos als gesehen
 */
export async function markVideosSeen(videoIds) {
  const history = await loadHistory();
  for (const videoId of videoIds) {
    history.seen[videoId] = true;
  }
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
export async function filterUnseenVideos(videos) {
  const history = await loadHistory();
  const cutoffDate = new Date('2026-01-01T00:00:00Z');
  
  return videos.filter(video => {
    // Muss ungesehen sein
    if (history.seen[video.id]) return false;
    
    // Muss ab 01.01.2026 sein
    if (video.publishedAt) {
      const publishDate = new Date(video.publishedAt);
      if (publishDate < cutoffDate) return false;
    }
    
    return true;
  });
}
