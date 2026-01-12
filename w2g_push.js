import fetch from 'node-fetch';

const W2G_API_KEY = process.env.W2G_API_KEY;
const W2G_ROOM_ID = process.env.W2G_ROOM_ID;
const W2G_API_BASE = 'https://api.w2g.tv';
const W2G_DRY_RUN = process.env.W2G_DRY_RUN === 'true';
const W2G_FORCE_LIVE = process.env.W2G_FORCE_LIVE === 'true';
const W2G_DEBUG = process.env.W2G_DEBUG === 'true';

// Rate-Limiting: Max 1 Request pro Sekunde
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 Sekunde

/**
 * Wartet, falls nötig, um Rate-Limits einzuhalten
 */
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Validiert API-Key und Room-ID Format
 * WICHTIG: Der API-Key muss zu einem Account gehören, der Mitglied des Rooms ist!
 */
function validateConfig() {
  // If force live is requested, require credentials regardless of DRY_RUN
  if (W2G_FORCE_LIVE) {
    if (!W2G_API_KEY || W2G_API_KEY.trim() === '') {
      throw new Error('W2G_API_KEY ist nicht gesetzt oder leer (required for FORCE_LIVE)');
    }
    if (!W2G_ROOM_ID || W2G_ROOM_ID.trim() === '') {
      throw new Error('W2G_ROOM_ID (streamkey) ist nicht gesetzt oder leer (required for FORCE_LIVE)');
    }
  }

  if (W2G_DRY_RUN && !W2G_FORCE_LIVE) {
    console.warn('[W2G] Running in DRY-RUN mode: real API calls are skipped.');
    // allow missing API credentials in dry-run
  } else {
    if (!W2G_API_KEY || W2G_API_KEY.trim() === '') {
      throw new Error('W2G_API_KEY ist nicht gesetzt oder leer');
    }
    
    if (!W2G_ROOM_ID || W2G_ROOM_ID.trim() === '') {
      throw new Error('W2G_ROOM_ID (streamkey) ist nicht gesetzt oder leer');
    }
    
    // Prüfe ob streamkey ein gültiges Format hat (alphanumerisch mit Bindestrichen/Unterstrichen)
    const streamkey = W2G_ROOM_ID.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(streamkey)) {
      throw new Error(`W2G_ROOM_ID (streamkey) hat ein ungültiges Format: ${streamkey}`);
    }
  }
  
  return true;
}

/**
 * Pusht Videos zur Watch2Gether Playlist
 * @param {Array} items - Array von {url, title}
 */
export async function pushVideosToW2G(items) {
  if (!items || items.length === 0) {
    throw new Error('Keine Videos zum Pushen');
  }

  // Validiere Konfiguration
  validateConfig();

  // Maximal 50 Videos pro Request (Bulk)
  const chunks = [];
  for (let i = 0; i < items.length; i += 50) {
    chunks.push(items.slice(i, i + 50));
  }

  const results = [];
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    
    // Rate-Limiting: Warte zwischen Requests
    if (chunkIndex > 0) {
      await waitForRateLimit();
    }
    
    try {
      // Laut Doku: streamkey ist der Teil nach /rooms/ in der URL
      // z.B. für https://w2g.tv/rooms/vyk4ah33xkzgwcwbf9 ist der streamkey: vyk4ah33xkzgwcwbf9
      const streamkey = W2G_ROOM_ID?.trim();
      
      const requestBody = {
        w2g_api_key: W2G_API_KEY?.trim(),
        add_items: chunk.map(item => ({
          url: item.url,
          title: item.title || 'Unbekanntes Video'
        }))
      };

      console.log(`[W2G] Pushe ${chunk.length} Videos zu Room (streamkey: ${streamkey || '[none]'})...`);

      if (W2G_DRY_RUN) {
        // Simuliere erfolgreichen Push
        console.log(`[W2G][DRY-RUN] Würde ${chunk.length} Items pushen. Beispiel Item:`, requestBody.add_items[0]);
        results.push({ success: true, count: chunk.length, data: { dryRun: true } });
        continue;
      }

      // Endpoint laut Doku: /rooms/{streamkey}/playlists/current/playlist_items/sync_update
      const endpoint = `${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items/sync_update`;
      
      const response = await fetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = `W2G API Fehler: ${response.status}`;
        console.log(response);
        
        // Versuche JSON zu parsen für detaillierte Fehlermeldung
        try {
          const errorData = JSON.parse(responseText);
          errorMessage += ` - ${errorData.message || JSON.stringify(errorData)}`;
          
          // Spezifische Fehlermeldungen
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
        } catch (e) {
          errorMessage += ` - ${responseText}`;
        }
        
        console.error(`[W2G] Fehler beim Pushen:`, {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
          streamkey: streamkey,
          endpoint: endpoint,
          apiKeyLength: W2G_API_KEY?.length || 0,
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
          if (W2G_DEBUG) console.warn('[W2G][DEBUG] responseText:', responseText);
          data = responseText;
        }
      } else {
        if (W2G_DEBUG) console.log('[W2G][DEBUG] Empty response body from W2G (this may be 204 No Content).');
        data = null;
      }
      console.log(`[W2G] Erfolgreich ${chunk.length} Videos gepusht`);
      if (W2G_DEBUG) console.log('[W2G][DEBUG] response data:', data);
      
      results.push({
        success: true,
        count: chunk.length,
        data
      });
    } catch (error) {
      console.error('[W2G] Fehler beim Pushen zu W2G:', error);
      
      // Wenn es ein Netzwerkfehler ist, nicht weiter versuchen
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error(`Netzwerkfehler bei Watch2Gether: ${error.message}`);
      }
      
      // Bei 403 oder 401 nicht weiter versuchen
      if (error.message.includes('403') || error.message.includes('401')) {
        throw error;
      }
      
      results.push({
        success: false,
        count: chunk.length,
        error: error.message
      });
      throw error;
    }
  }

  return results;
}

/**
 * Testet die Watch2Gether API-Verbindung
 * Versucht ein einzelnes Test-Video zu pushen
 */
export async function testW2GConnection() {
  // Allow a dry-run test without real API credentials
  if (W2G_DRY_RUN) {
    console.log('[W2G][DRY-RUN] testW2GConnection called — skipping real API call.');
    return { success: true, message: '✅ DRY-RUN: Test-Simulation erfolgreich (kein echter Push).' };
  }

  validateConfig();
  
  try {
    const streamkey = W2G_ROOM_ID.trim();
    const testItem = {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test-Video
      title: 'Test Video'
    };
    
    const requestBody = {
      w2g_api_key: W2G_API_KEY.trim(),
      add_items: [testItem]
    };
    
    const response = await fetch(
      `${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items/sync_update`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    const responseText = await response.text();
    
    if (response.ok) {
      return { 
        success: true, 
        message: '✅ API-Verbindung erfolgreich! Test-Video wurde hinzugefügt.' 
      };
    } else {
      let errorMsg = `Verbindung fehlgeschlagen: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
      } catch (e) {
        errorMsg += ` - ${responseText}`;
      }
      
      if (response.status === 403) {
        console.log(response)
        errorMsg += '\n\n⚠️ WICHTIG: Der API-User MUSS ein Mitglied des Rooms sein!';
        errorMsg += '\nBetrete den Room mit dem Account, der den API-Key hat.';
      }
      
      return { 
        success: false, 
        message: errorMsg 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Verbindungsfehler: ${error.message}` 
    };
  }
}

/**
 * Holt die aktuelle Playlist Items des Rooms
 */
export async function getCurrentPlaylist() {
  // Respect dry-run: if dry-run, return a simulated response
  if (W2G_DRY_RUN) {
    console.log('[W2G][DRY-RUN] getCurrentPlaylist called — returning simulated empty playlist.');
    return { success: true, items: [], note: 'DRY-RUN' };
  }

  validateConfig();

  try {
    const streamkey = W2G_ROOM_ID.trim();
    const endpoint = `${W2G_API_BASE}/rooms/${streamkey}/playlists/current/playlist_items`;

    if (W2G_DEBUG) console.log(`[W2G][DEBUG] GET ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const text = await response.text();
    if (!response.ok) {
      let errMsg = `W2G GET Fehler: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(text);
        errMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
      } catch (e) {
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
        if (W2G_DEBUG) console.warn('[W2G][DEBUG] playlist text:', text);
        data = text;
      }
    } else {
      if (W2G_DEBUG) console.log('[W2G][DEBUG] Empty playlist response body from W2G (maybe no playlist yet).');
      data = null;
    }
    if (W2G_DEBUG) console.log('[W2G][DEBUG] playlist data:', data);

    return { success: true, items: data };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Erstellt eine YouTube-URL aus einer Video-ID
 */
export function createYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Gibt die W2G Room-URL zurück
 */
export function getW2GRoomUrl() {
  // Read env at call-time to reflect current configuration in tests/runtime
  const streamkey = (process.env.W2G_ROOM_ID || '').trim();
  if (!streamkey) {
    return null;
  }
  return `https://w2g.tv/rooms/${streamkey}`;
}
