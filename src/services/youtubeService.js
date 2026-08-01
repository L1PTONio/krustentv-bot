const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export class ExternalServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ExternalServiceError';
    this.code = options.code || 'YOUTUBE_ERROR';
    this.cause = options.cause;
  }
}

function parseDuration(duration) {
  const match = duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeLiveStatus(item) {
  if (item?.liveStreamingDetails?.actualStartTime) {
    return 'live';
  }

  if (item?.liveStreamingDetails?.scheduledStartTime) {
    return 'upcoming';
  }

  const uploadStatus = item?.status?.uploadStatus || item?.snippet?.liveBroadcastContent || '';
  if (uploadStatus === 'uploaded' || uploadStatus === 'processed' || uploadStatus === 'none') {
    return 'archived';
  }

  return 'unknown';
}

function normalizeVideoMetadata(item = {}) {
  return {
    videoId: item.id,
    title: item.snippet?.title || null,
    channelId: item.snippet?.channelId || null,
    channelTitle: item.snippet?.channelTitle || null,
    publishedAt: item.snippet?.publishedAt || item.liveStreamingDetails?.scheduledStartTime || null,
    durationSeconds: parseDuration(item.contentDetails?.duration),
    liveStatus: normalizeLiveStatus(item),
    isLivestream: Boolean(item.liveStreamingDetails?.actualStartTime || item.snippet?.liveBroadcastContent === 'live' || item.liveStreamingDetails?.scheduledStartTime),
    thumbnailUrl: item.snippet?.thumbnails?.default?.url || null,
    metadata: item
  };
}

function validateYouTubeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExternalServiceError('YouTube request URL is invalid');
  }

  if (url.protocol !== 'https:') {
    throw new ExternalServiceError('Only HTTPS YouTube requests are allowed');
  }

  if (url.username || url.password || url.port) {
    throw new ExternalServiceError('YouTube request URL contains unexpected credentials or port');
  }

  const allowedHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'googleapis.com', 'www.googleapis.com']);
  if (!allowedHosts.has(url.hostname)) {
    throw new ExternalServiceError(`YouTube request host is not allowed: ${url.hostname}`);
  }

  if (url.hostname.includes('googleapis.com') && !url.pathname.startsWith('/youtube/v3/')) {
    throw new ExternalServiceError('YouTube API paths must stay within the YouTube Data API namespace');
  }

  return url;
}

function buildYouTubeUrl(path, apiKey) {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  if (apiKey) {
    url.searchParams.set('key', apiKey);
  }
  return url.toString();
}

export function createSafeYouTubeService({ apiKey = '', requestTimeoutMs = 10000, fetchImpl = fetch } = {}) {
  async function requestJson(rawUrl, options = {}) {
    const url = validateYouTubeUrl(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetchImpl(url.toString(), { ...options, signal: controller.signal, headers: { ...(options.headers || {}), 'User-Agent': 'KrustenTV-Bot/1.0' } });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ExternalServiceError(`YouTube request failed with status ${response.status}${body ? `: ${body}` : ''}`);
      }

      const body = await response.json();
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ExternalServiceError('YouTube request timed out', { code: 'TIMEOUT' });
      }
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('YouTube request failed', { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  async function getChannelInfo(channelId) {
    const data = await requestJson(buildYouTubeUrl(`/channels?part=snippet&id=${encodeURIComponent(channelId)}`, apiKey));
    const item = Array.isArray(data?.items) && data.items.length > 0 ? data.items[0] : null;
    return item ? { id: item.id, name: item.snippet?.title || null } : null;
  }

  async function getChannelVideos(channelId, maxResults = 50) {
    const resolvedId = channelId;
    const channelData = await requestJson(buildYouTubeUrl(`/channels?part=contentDetails&id=${encodeURIComponent(resolvedId)}`, apiKey));
    const channelItem = Array.isArray(channelData?.items) && channelData.items.length > 0 ? channelData.items[0] : null;
    if (!channelItem?.contentDetails?.relatedPlaylists?.uploads) {
      throw new ExternalServiceError(`Channel ${channelId} not found`);
    }

    const videosData = await requestJson(buildYouTubeUrl(`/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(channelItem.contentDetails.relatedPlaylists.uploads)}&maxResults=${maxResults}`, apiKey));
    if (!Array.isArray(videosData?.items)) {
      return [];
    }

    return videosData.items.map(item => ({
      id: item.contentDetails?.videoId,
      title: item.snippet?.title || null,
      publishedAt: item.contentDetails?.videoPublishedAt || null,
      channelId: item.snippet?.channelId || null,
      channelTitle: item.snippet?.channelTitle || null,
      thumbnail: item.snippet?.thumbnails?.default?.url || null
    }));
  }

  async function getVideoDetails(videoId) {
    const data = await requestJson(buildYouTubeUrl(`/videos?part=contentDetails,statistics&id=${encodeURIComponent(videoId)}`, apiKey));
    const item = Array.isArray(data?.items) && data.items.length > 0 ? data.items[0] : null;
    if (!item) {
      return null;
    }

    return {
      duration: parseDuration(item.contentDetails?.duration),
      viewCount: parseInt(item.statistics?.viewCount, 10) || 0
    };
  }

  async function getVideoDetailsBatch(videoIds = []) {
    const validIds = (videoIds || []).filter(Boolean);
    if (validIds.length === 0) {
      return { items: [], missing: [] };
    }

    const uniqueIds = [...new Set(validIds)];
    const normalizedItems = [];
    const missing = [];

    for (let index = 0; index < uniqueIds.length; index += 50) {
      const batchIds = uniqueIds.slice(index, index + 50);
      const data = await requestJson(buildYouTubeUrl(`/videos?part=snippet,contentDetails,liveStreamingDetails,status&id=${batchIds.join(',')}`, apiKey));
      const items = Array.isArray(data?.items) ? data.items : [];
      const foundIds = new Set(items.map(item => item.id));
      batchIds.forEach(id => {
        if (!foundIds.has(id)) {
          missing.push(id);
        }
      });
      normalizedItems.push(...items.map(normalizeVideoMetadata));
    }

    return {
      items: normalizedItems,
      missing
    };
  }

  return {
    requestJson,
    getChannelInfo,
    getChannelVideos,
    getVideoDetails,
    getVideoDetailsBatch
  };
}
