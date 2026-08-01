import fetch from 'node-fetch';
import { createSafeYouTubeService } from './src/services/youtubeService.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
let configuredService = null;
let hasConfiguredService = false;

/**
 * Erzeugt einen YouTube-Service mit konfigurierter API-Key.
 * @param {{ apiKey?: string, requestTimeoutMs?: number }} config
 * @returns {{ getChannelInfo, resolveChannelId, getChannelVideos, getVideoDetails }}
 */
export function createYouTubeService(config = {}) {
  const service = createSafeYouTubeService({
    apiKey: config.apiKey || '',
    requestTimeoutMs: config.requestTimeoutMs || 10000,
    fetchImpl: config.fetchImpl || fetch
  });

  async function resolveChannelId(input) {
    if (!input) {
      throw new Error('Keine Eingabe angegeben');
    }

    let decoded = input.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      decoded = input.trim();
    }

    if (/^UC[a-zA-Z0-9_-]{22}$/.test(decoded)) {
      return decoded;
    }

    if (decoded.includes('/channel/')) {
      const id = decoded.split('/channel/')[1]?.split(/[?/&#]/)[0]?.trim();
      if (id && /^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
        return id;
      }
    }

    const handleMatch = decoded.match(/@([a-zA-Z0-9._-]+)/);
    if (handleMatch) {
      const channelId = await resolveViaHandle(handleMatch[1], config.apiKey || '', config.fetchImpl || fetch);
      if (channelId) return channelId;
    }

    if (decoded.includes('youtube.com')) {
      let urlToFetch = decoded;
      if (!urlToFetch.startsWith('http://') && !urlToFetch.startsWith('https://')) {
        urlToFetch = 'https://' + urlToFetch;
      }

      const urlVariants = [urlToFetch, urlToFetch.replace(/\/$/, ''), urlToFetch + '/'];
      for (const url of urlVariants) {
        const htmlId = await resolveViaHtml(url, config.fetchImpl || fetch);
        if (htmlId) return htmlId;
      }
    }

    const cMatch = decoded.match(/youtube\.com\/c\/([^/\s?&#]+)/i);
    const userMatch = decoded.match(/youtube\.com\/user\/([^/\s?&#]+)/i);
    if (cMatch || userMatch) {
      const identifier = (cMatch?.[1] || userMatch?.[1] || '').trim();
      if (identifier) {
        const fullUrl = `https://www.youtube.com/c/${identifier}`;
        const htmlId = await resolveViaHtml(fullUrl, config.fetchImpl || fetch);
        if (htmlId) return htmlId;
        if (userMatch) {
          const userUrl = `https://www.youtube.com/user/${identifier}`;
          const userHtmlId = await resolveViaHtml(userUrl, config.fetchImpl || fetch);
          if (userHtmlId) return userHtmlId;
        }
      }
    }

    const safeSearchId = await searchAndVerify(decoded, config.apiKey || '', config.fetchImpl || fetch);
    if (safeSearchId) return safeSearchId;

    throw new Error(`Konnte Channel-ID nicht auflösen: ${input}`);
  }

  async function getChannelInfo(channelId) {
    try {
      return await service.getChannelInfo(channelId);
    } catch (error) {
      console.error(`Fehler beim Abrufen von Channel ${channelId}:`, error);
      throw error;
    }
  }

  async function getChannelVideos(channelId, maxResults = 50) {
    try {
      let resolvedId = channelId;
      if (!channelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
        resolvedId = await resolveChannelId(channelId);
      }

      return await service.getChannelVideos(resolvedId, maxResults);
    } catch (error) {
      console.error(`Fehler beim Abrufen von Videos für Channel ${channelId}:`, error);
      throw error;
    }
  }

  async function getVideoDetails(videoId) {
    try {
      return await service.getVideoDetails(videoId);
    } catch (error) {
      console.error(`Fehler beim Abrufen von Video-Details für ${videoId}:`, error);
      return null;
    }
  }

  return {
    getChannelInfo,
    resolveChannelId,
    getChannelVideos,
    getVideoDetails,
    getVideoDetailsBatch: service.getVideoDetailsBatch
  };
}

async function resolveViaHandle(handle, apiKey, fetchImpl = fetch) {
  if (!apiKey) return null;
  const url = `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  try {
    const res = await fetchImpl(url);
    const json = await res.json();
    return json?.items?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function resolveViaHtml(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    const match = html.match(/channelId":"([A-Za-z0-9_-]{24,})"/i);
    if (match) return match[1];

    const idMatch = html.match(/"channelId":"([A-Za-z0-9_-]+)"/i);
    if (idMatch) return idMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function searchAndVerify(query, apiKey, fetchImpl = fetch) {
  let searchQuery = query;
  if (query.includes('youtube.com')) {
    const cMatch = query.match(/\/c\/([^/\s?&#]+)/i);
    const userMatch = query.match(/\/user\/([^/\s?&#]+)/i);
    const handleMatch = query.match(/@([a-zA-Z0-9._-]+)/);
    if (cMatch) {
      searchQuery = cMatch[1];
    } else if (userMatch) {
      searchQuery = userMatch[1];
    } else if (handleMatch) {
      searchQuery = handleMatch[1];
    }
  }

  if (!apiKey) return null;
  const url = `${YOUTUBE_API_BASE}/search?part=id&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=10&key=${apiKey}`;

  try {
    const res = await fetchImpl(url);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id.channelId || null;
    }
    return null;
  } catch {
    return null;
  }
}

function getDefaultService() {
  if (!hasConfiguredService || !configuredService) {
    throw new Error('YouTube service is not configured. Call configureYouTubeService(...) before use.');
  }
  return configuredService;
}

export function configureYouTubeService(config = {}) {
  if (config && typeof config.getChannelInfo === 'function') {
    configuredService = config;
  } else {
    configuredService = createYouTubeService(config);
  }
  hasConfiguredService = true;
  return configuredService;
}

export function resetYouTubeService() {
  configuredService = null;
  hasConfiguredService = false;
}

export function getChannelInfo(channelId) {
  return getDefaultService().getChannelInfo(channelId);
}

export function resolveChannelId(input) {
  return getDefaultService().resolveChannelId(input);
}

export function getChannelVideos(channelId, maxResults = 50) {
  return getDefaultService().getChannelVideos(channelId, maxResults);
}

export function getVideoDetails(videoId) {
  return getDefaultService().getVideoDetails(videoId);
}
