function isLikelyShort(video) {
  const title = String(video?.title || '').toLowerCase();
  return /(^|[^a-z0-9])#?shorts?([^a-z0-9]|$)/i.test(title);
}

export function filterVideosByMinDuration(videos = [], minSeconds = 60, options = {}) {
  const threshold = Math.max(0, Number(minSeconds) || 0);
  const excludeLikelyShorts = Boolean(options.excludeLikelyShorts);
  const kept = [];
  let removedCount = 0;

  for (const video of videos || []) {
    if (excludeLikelyShorts && isLikelyShort(video)) {
      removedCount += 1;
      continue;
    }

    const duration = Number(video?.duration ?? video?.durationSeconds ?? 0);
    if (Number.isFinite(duration) && duration >= threshold) {
      kept.push(video);
    } else {
      removedCount += 1;
    }
  }

  return { videos: kept, removedCount };
}
