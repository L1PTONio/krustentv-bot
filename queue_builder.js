import { getVideoDetails } from './youtube.js';

/**
 * Baut eine Queue basierend auf Watchtime und Toleranz
 * @param {Array} videos - Array von Video-Objekten mit {id, title, duration}
 * @param {number} targetMinutes - Ziel-Watchtime in Minuten
 * @param {number} toleranceMinutes - Toleranz in Minuten (Standard: 15)
 * @returns {Array} - Queue von Videos (ALT → NEU sortiert)
 */
export async function buildQueue(videos, targetMinutes, toleranceMinutes = 15) {
  // Backwards-compatible: if videos is an object (categories map), delegate to weighted builder
  if (videos && typeof videos === 'object' && !Array.isArray(videos)) {
    return buildWeightedQueue(videos, targetMinutes, toleranceMinutes);
  }

  const targetSeconds = targetMinutes * 60;
  const toleranceSeconds = toleranceMinutes * 60;
  const maxSeconds = targetSeconds + toleranceSeconds;
  const minSeconds = Math.max(0, targetSeconds - toleranceSeconds);

  // Sortiere Videos nach publishedAt (ALT → NEU)
  const sortedVideos = [...videos].sort((a, b) => {
    const dateA = new Date(a.publishedAt || 0);
    const dateB = new Date(b.publishedAt || 0);
    return dateA - dateB;
  });

  // Hole Video-Details für alle Videos (falls duration fehlt)
  const videosWithDuration = [];
  for (const video of sortedVideos) {
    let duration = video.duration;
    if (!duration) {
      const details = await getVideoDetails(video.id);
      duration = details?.duration || 0;
    }
    videosWithDuration.push({
      ...video,
      duration
    });
  }

  // Baue Queue mit Greedy-Algorithmus
  const queue = [];
  let totalSeconds = 0;

  for (const video of videosWithDuration) {
    if (totalSeconds + video.duration <= maxSeconds) {
      queue.push(video);
      totalSeconds += video.duration;
      
      // Wenn wir über dem Minimum sind, können wir aufhören
      if (totalSeconds >= minSeconds) {
        break;
      }
    }
  }

  return {
    queue,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    targetMinutes,
    toleranceMinutes
  };
}

/**
 * Berechnet Gesamt-Watchtime einer Video-Liste
 */
export function calculateTotalWatchtime(videos) {
  const totalSeconds = videos.reduce((sum, video) => {
    return sum + (video.duration || 0);
  }, 0);
  
  return {
    seconds: totalSeconds,
    minutes: Math.round(totalSeconds / 60)
  };
}

/**
 * Builds a weighted queue from a map of categories:
 * {
 *   categoryName: { weight: number, videos: [video,...] }
 * }
 */
export async function buildWeightedQueue(categoryMap, targetMinutes, toleranceMinutes = 15, options = {}) {
  const strategy = options.strategy || 'shuffle'; // 'shuffle' | 'category_blocks' | 'manual_order'
  const categoryOrder = options.categoryOrder || [];

  const targetSeconds = targetMinutes * 60;
  const toleranceSeconds = toleranceMinutes * 60;
  const maxSeconds = targetSeconds + toleranceSeconds;
  const minSeconds = Math.max(0, targetSeconds - toleranceSeconds);

  // Normalize categories: ensure weight >= 0 and videos arrays exist
  let entries = Object.entries(categoryMap)
    .map(([name, data]) => ({
      name,
      weight: Math.max(0, Number(data.weight || 1)),
      videos: Array.isArray(data.videos) ? [...data.videos] : []
    }))
    .filter(e => e.weight > 0 && e.videos.length > 0);

  // If no eligible categories, return empty result
  if (entries.length === 0) {
    return {
      queue: [],
      totalSeconds: 0,
      totalMinutes: 0,
      targetMinutes,
      toleranceMinutes
    };
  }

  // Sort videos within each category ALT -> NEU (stable)
  for (const e of entries) {
    e.videos.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
  }

  // Determine processing order based on strategy
  let orderedCategoryNames = entries.map(e => e.name);
  if (strategy === 'manual_order' && Array.isArray(categoryOrder) && categoryOrder.length > 0) {
    // Respect manual order, but filter out categories not present
    orderedCategoryNames = categoryOrder.filter(n => entries.some(e => e.name === n));
  } else if (strategy === 'category_blocks') {
    // Default block order: alphabetical
    orderedCategoryNames = orderedCategoryNames.sort();
  } else if (strategy === 'shuffle') {
    // We'll use weighted shuffle later
  }

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);

  // Build a map for quick lookup
  const entriesByName = Object.fromEntries(entries.map(e => [e.name, { ...e }]));

  // Helper to pick videos from a category (FIFO: ALT -> NEU)
  const pickFromCategory = (name) => {
    const cat = entriesByName[name];
    if (!cat || cat.videos.length === 0) return null;
    return cat.videos.shift();
  };

  const usedVideoIds = new Set();
  const queue = [];
  let totalSeconds = 0;

  if (strategy === 'shuffle') {
    // Build weighted pool of category names
    const pool = [];
    for (const e of entries) {
      for (let i = 0; i < e.weight; i++) pool.push(e.name);
    }

    // Shuffle pool (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Iterate over pool cyclically, picking one from each category per appearance
    let poolIdx = 0;
    while (totalSeconds < maxSeconds) {
      if (pool.length === 0) break;
      const catName = pool[poolIdx % pool.length];
      const v = pickFromCategory(catName);
      poolIdx++;
      if (!v) {
        // No video available in this category anymore -> remove all its occurrences from pool
        for (let k = pool.length - 1; k >= 0; k--) if (pool[k] === catName) pool.splice(k, 1);
        continue;
      }
      if (usedVideoIds.has(v.id)) continue;
      const dur = v.duration ?? (await getVideoDetails(v.id)).duration ?? 0;
      if (totalSeconds + dur > maxSeconds) break;
      queue.push({ ...v, duration: dur });
      usedVideoIds.add(v.id);
      totalSeconds += dur;
      // stop early if reached at least minSeconds and we're allowed
      if (totalSeconds >= minSeconds && totalSeconds >= targetSeconds) break;
    }
  } else {
    // category_blocks or manual_order: process categories in orderedCategoryNames
    for (const catName of orderedCategoryNames) {
      const cat = entriesByName[catName];
      if (!cat) continue;
      while (cat.videos.length > 0) {
        const v = pickFromCategory(catName);
        if (!v) break;
        if (usedVideoIds.has(v.id)) continue;
        const dur = v.duration ?? (await getVideoDetails(v.id)).duration ?? 0;
        if (totalSeconds + dur > maxSeconds) break;
        queue.push({ ...v, duration: dur });
        usedVideoIds.add(v.id);
        totalSeconds += dur;
        if (totalSeconds >= minSeconds && totalSeconds >= targetSeconds) break;
      }
      if (totalSeconds >= targetSeconds) break;
    }

    // If under target, try to fill from remaining categories (round-robin)
    if (totalSeconds < targetSeconds) {
      // gather any leftover videos
      const leftovers = [];
      for (const e of Object.values(entriesByName)) {
        while (e.videos.length > 0) {
          const v = e.videos.shift();
          if (!usedVideoIds.has(v.id)) leftovers.push(v);
        }
      }
      let idx = 0;
      while (totalSeconds < targetSeconds && idx < leftovers.length) {
        const v = leftovers[idx++];
        const dur = v.duration ?? (await getVideoDetails(v.id)).duration ?? 0;
        if (totalSeconds + dur > maxSeconds) break;
        queue.push({ ...v, duration: dur });
        usedVideoIds.add(v.id);
        totalSeconds += dur;
      }
    }
  }

  // Final safety: if queue empty and there were videos, pick the first available
  if (queue.length === 0) {
    const anyEntry = entries.find(e => e.videos.length > 0) || entries[0];
    if (anyEntry && anyEntry.videos.length > 0) {
      const v = anyEntry.videos.shift();
      const dur = v.duration ?? (await getVideoDetails(v.id)).duration ?? 0;
      if (dur > 0) {
        queue.push({ ...v, duration: dur });
        totalSeconds += dur;
      }
    }
  }

  return {
    queue,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    targetMinutes,
    toleranceMinutes
  };
}
