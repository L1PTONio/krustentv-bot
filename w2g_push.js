import fetch from 'node-fetch';

const W2G_API_BASE = 'https://api.w2g.tv';
const MIN_REQUEST_INTERVAL = 1000;
let configuredService = null;
let hasConfiguredService = false;

/**
 * Erzeugt einen Watch2Gether-Service mit Konfiguration.
 * @param {{ apiKey?: string, roomId?: string, dryRun?: boolean, forceLive?: boolean, debug?: boolean, requestTimeoutMs?: number, minRequestIntervalMs?: number }} config
 * @returns {{ pushVideosToW2G, testW2GConnection, getCurrentPlaylist, createYouTubeUrl, getW2GRoomUrl }}
 */
export function createW2GService(config = {}) {
  const apiKey = config.apiKey || '';
  const roomId = config.roomId || '';
  const dryRun = Boolean(config.dryRun);
  const forceLive = Boolean(config.forceLive);
  const debug = Boolean(config.debug);
  const fetchImpl = config.fetchImpl || fetch;
  const minRequestIntervalMs = Math.max(1, Number(config.minRequestIntervalMs) || MIN_REQUEST_INTERVAL);
  let lastRequestTime = 0;

  function validateConfig() {
    if (forceLive) {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('W2G_API_KEY ist nicht gesetzt oder leer (required for FORCE_LIVE)');
      }
      if (!roomId || roomId.trim() === '') {
        throw new Error('W2G_ROOM_ID (streamkey) ist nicht gesetzt oder leer (required for FORCE_LIVE)');
      }
    }

    if (dryRun && !forceLive) {
      console.warn('[W2G] Running in DRY-RUN mode: real API calls are skipped.');
    } else {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('W2G_API_KEY ist nicht gesetzt oder leer');
      }
      if (!roomId || roomId.trim() === '') {
        throw new Error('W2G_ROOM_ID (streamkey) ist nicht gesetzt oder leer');
      }
      const streamkey = roomId.trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(streamkey)) {
        throw new Error(`W2G_ROOM_ID (streamkey) hat ein ungültiges Format: ${streamkey}`);
      }
    }
    return true;
  }

  async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < minRequestIntervalMs) {
      const waitTime = minRequestIntervalMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
  }

  async function pushVideosToW2G(items) {
    if (!items || items.length === 0) {
      throw new Error('Keine Videos zum Pushen');
    }

    validateConfig();

    const chunks = [];
    for (let i = 0; i < items.length; i += 50) {
      chunks.push(items.slice(i, i + 50));
    }

    const results = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      if (chunkIndex > 0) {
        await waitForRateLimit();
      }

      try {
        const streamkey = roomId?.trim();
        const requestBody = {
          w2g_api_key: apiKey?.trim(),
          add_items: chunk.map(item => ({ url: item.url, title: item.title || 'Unbekanntes Video' }))
        };

        console.log(`[W2G] Pushe ${chunk.length} Videos zu Room (streamkey: ${streamkey || '[none]'})...`);
        if (dryRun) {
          console.log(`[W2G][DRY-RUN] Würde ${chunk.length} Items pushen. Beispiel Item:`, requestBody.add_items[0]);
          results.push({ success: true, count: chunk.length, data: { dryRun: true } });
          continue;
        }

        const endpoint = `${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items/sync_update`;
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        if (!response.ok) {
          let errorMessage = `W2G API Fehler: ${response.status}`;
          try {
            const errorData = JSON.parse(responseText);
            errorMessage += ` - ${errorData.message || JSON.stringify(errorData)}`;
            if (response.status === 403) {
              errorMessage += '\n\n⚠️ WICHTIG laut API-Dokumentation:\n';
              errorMessage += 'Der API-User MUSS ein Mitglied des Rooms sein!\n\n';
              errorMessage += 'Mögliche Ursachen:\n';
              errorMessage += '1. API-Key ist ungültig oder abgelaufen\n';
              errorMessage += '2. API-Key gehört zu einem Account, der NICHT Mitglied des Rooms ist\n';
              errorMessage += '   → Lösung: Betrete den Room mit dem Account, der den API-Key hat\n';
              errorMessage += '3. Streamkey (Room-ID) ist falsch\n';
              errorMessage += '   → Der streamkey ist der Teil nach /rooms/ in der URL\n';
              errorMessage += '   → z.B. für https://w2g.tv/rooms/vyk4ah33xkzgwcwbf9 ist der streamkey: vyk4ah33xkzgwcwbf9\n';
              errorMessage += '4. Rate-Limit überschritten (zu viele Requests)\n';
              errorMessage += '5. IP-Adresse wurde temporär blockiert';
            }
          } catch {
            errorMessage += ` - ${responseText}`;
          }

          console.error('[W2G] Fehler beim Pushen:', {
            status: response.status,
            statusText: response.statusText,
            body: responseText,
            streamkey,
            endpoint,
            apiKeyLength: apiKey?.length || 0,
            itemCount: chunk.length,
            requestBody: { ...requestBody, w2g_api_key: '[REDACTED]' }
          });

          throw new Error(errorMessage);
        }

        let data = null;
        if (responseText && responseText.trim().length > 0) {
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.warn('[W2G][WARN] Failed to parse JSON response, returning raw text instead:', e);
            if (debug) console.warn('[W2G][DEBUG] responseText:', responseText);
            data = responseText;
          }
        } else {
          if (debug) console.log('[W2G][DEBUG] Empty response body from W2G (this may be 204 No Content).');
          data = null;
        }
        console.log(`[W2G] Erfolgreich ${chunk.length} Videos gepusht`);
        if (debug) console.log('[W2G][DEBUG] response data:', data);
        results.push({ success: true, count: chunk.length, data });
      } catch (error) {
        console.error('[W2G] Fehler beim Pushen zu W2G:', error);
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          throw new Error(`Netzwerkfehler bei Watch2Gether: ${error.message}`, { cause: error });
        }
        if (error.message.includes('403') || error.message.includes('401')) {
          throw error;
        }
        results.push({ success: false, count: chunk.length, error: error.message });
        throw error;
      }
    }

    return results;
  }

  async function testW2GConnection() {
    if (dryRun) {
      console.log('[W2G][DRY-RUN] testW2GConnection called — skipping real API call.');
      return { success: true, message: '✅ DRY-RUN: Test-Simulation erfolgreich (kein echter Push).' };
    }

    validateConfig();
    try {
      const streamkey = roomId.trim();
      const testItem = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Test Video' };
      const requestBody = { w2g_api_key: apiKey.trim(), add_items: [testItem] };
      const response = await fetchImpl(`${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items/sync_update`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const responseText = await response.text();

      if (response.ok) {
        return { success: true, message: '✅ API-Verbindung erfolgreich! Test-Video wurde hinzugefügt.' };
      }

      let errorMsg = `Verbindung fehlgeschlagen: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
      } catch {
        errorMsg += ` - ${responseText}`;
      }
      if (response.status === 403) {
        console.log(response);
        errorMsg += '\n\n⚠️ WICHTIG: Der API-User MUSS ein Mitglied des Rooms sein!';
        errorMsg += '\nBetrete den Room mit dem Account, der den API-Key hat.';
      }
      return { success: false, message: errorMsg };
    } catch (error) {
      return { success: false, message: `Verbindungsfehler: ${error.message}` };
    }
  }

  async function getCurrentPlaylist() {
    if (dryRun) {
      console.log('[W2G][DRY-RUN] getCurrentPlaylist called — returning simulated empty playlist.');
      return { success: true, items: [], note: 'DRY-RUN' };
    }

    validateConfig();
    try {
      const streamkey = roomId.trim();
      const endpoint = `${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items`;
      if (debug) console.log(`[W2G][DEBUG] GET ${endpoint}`);
      const response = await fetchImpl(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await response.text();
      if (!response.ok) {
        let errMsg = `W2G GET Fehler: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(text);
          errMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
        } catch {
          errMsg += ` - ${text}`;
        }
        throw new Error(errMsg);
      }

      let data = null;
      if (text && text.trim().length > 0) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn('[W2G][WARN] Failed to parse playlist JSON, returning raw text instead:', e);
          if (debug) console.warn('[W2G][DEBUG] playlist text:', text);
          data = text;
        }
      } else {
        if (debug) console.log('[W2G][DEBUG] Empty playlist response body from W2G (maybe no playlist yet).');
        data = null;
      }
      if (debug) console.log('[W2G][DEBUG] playlist data:', data);
      return { success: true, items: data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  function createYouTubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function getW2GRoomUrl() {
    const streamkey = (roomId || '').trim();
    if (!streamkey) {
      return null;
    }
    return `https://w2g.tv/rooms/${streamkey}`;
  }

  return { pushVideosToW2G, testW2GConnection, getCurrentPlaylist, createYouTubeUrl, getW2GRoomUrl };
}

function getDefaultService() {
  if (!hasConfiguredService || !configuredService) {
    throw new Error('W2G service is not configured. Call configureW2GService(...) before use.');
  }
  return configuredService;
}

export function configureW2GService(config = {}) {
  if (config && typeof config.pushVideosToW2G === 'function') {
    configuredService = config;
  } else {
    configuredService = createW2GService(config);
  }
  hasConfiguredService = true;
  return configuredService;
}

export function resetW2GService() {
  configuredService = null;
  hasConfiguredService = false;
}

export function pushVideosToW2G(items) {
  return getDefaultService().pushVideosToW2G(items);
}

export function testW2GConnection() {
  return getDefaultService().testW2GConnection();
}

export function getCurrentPlaylist() {
  return getDefaultService().getCurrentPlaylist();
}

export function createYouTubeUrl(videoId) {
  return getDefaultService().createYouTubeUrl(videoId);
}

export function getW2GRoomUrl() {
  if (!hasConfiguredService || !configuredService) {
    return null;
  }
  return configuredService.getW2GRoomUrl();
}
