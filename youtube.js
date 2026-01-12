import fetch from 'node-fetch';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Holt Channel-Informationen von YouTube
 */
export async function getChannelInfo(channelId) {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return {
        id: data.items[0].id,
        name: data.items[0].snippet.title
      };
    }
    return null;
  } catch (error) {
    console.error(`Fehler beim Abrufen von Channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Löst einen YouTube-Input (URL, Channel-ID, Username) zu einer Channel-ID auf
 */
export async function resolveChannelId(input) {
  if (!input) {
    throw new Error('Keine Eingabe angegeben');
  }

  // Dekodiere Input sicher
  let decoded = input.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch (e) {
    // Falls Dekodierung fehlschlägt, verwende Original
    decoded = input.trim();
  }

  /* ---------- 1. UC-ID direkt ---------- */
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(decoded)) {
    return decoded;
  }

  /* ---------- 2. /channel/UCxxxx ---------- */
  if (decoded.includes('/channel/')) {
    const id = decoded.split('/channel/')[1]?.split(/[?/&#]/)[0]?.trim();
    if (id && /^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
      return id;
    }
  }

  /* ---------- 3. @Handle (SAUBER, OHNE SEARCH) ---------- */
  const handleMatch = decoded.match(/@([a-zA-Z0-9._-]+)/);
  if (handleMatch) {
    const channelId = await resolveViaHandle(handleMatch[1]);
    if (channelId) return channelId;
  }

  /* ---------- 4. HTML-Fallback (Vanity, Sonderzeichen) - PRIORITÄT ---------- */
  if (decoded.includes('youtube.com')) {
    // Normalisiere URL (füge https:// hinzu falls fehlt)
    let urlToFetch = decoded;
    if (!urlToFetch.startsWith('http://') && !urlToFetch.startsWith('https://')) {
      urlToFetch = 'https://' + urlToFetch;
    }
    
    // Versuche verschiedene URL-Varianten
    const urlVariants = [
      urlToFetch,
      urlToFetch.replace(/\/$/, ''), // Ohne trailing slash
      urlToFetch + '/', // Mit trailing slash
    ];

    for (const url of urlVariants) {
      const htmlId = await resolveViaHtml(url);
      if (htmlId) return htmlId;
    }
  }

  /* ---------- 5. /c/ oder /user/ URL - Extrahiere Identifier und suche ---------- */
  const cMatch = decoded.match(/youtube\.com\/c\/([^\/\s\?&#]+)/i);
  const userMatch = decoded.match(/youtube\.com\/user\/([^\/\s\?&#]+)/i);
  
  if (cMatch || userMatch) {
    const identifier = (cMatch?.[1] || userMatch?.[1] || '').trim();
    if (identifier) {
      // Versuche HTML-Parsing mit vollständiger URL
      const fullUrl = `https://www.youtube.com/c/${identifier}`;
      const htmlId = await resolveViaHtml(fullUrl);
      if (htmlId) return htmlId;
      
      // Versuche auch mit /user/
      if (userMatch) {
        const userUrl = `https://www.youtube.com/user/${identifier}`;
        const userHtmlId = await resolveViaHtml(userUrl);
        if (userHtmlId) return userHtmlId;
      }
    }
  }

  /* ---------- 6. LETZTER NOTFALL: Search + Verifikation ---------- */
  const safeSearchId = await searchAndVerify(decoded);
  if (safeSearchId) return safeSearchId;

  /* ---------- 7. Nichts gefunden ---------- */
  throw new Error(`Konnte Channel-ID nicht auflösen: ${input}`);
}

/**
 * Holt die neuesten Videos eines Channels
 */
export async function getChannelVideos(channelId, maxResults = 50) {
  try {
    // Resolve channelId falls es eine URL oder Handle ist
    let resolvedId = channelId;
    if (!channelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
      // Nicht im UC-ID Format -> auflösen
      resolvedId = await resolveChannelId(channelId);
    }

    // Zuerst die Upload-Playlist-ID holen
    const channelResponse = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${resolvedId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Channel ${channelId} nicht gefunden`);
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
    
    // Videos aus der Upload-Playlist holen
    const videosResponse = await fetch(
      `${YOUTUBE_API_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );
    const videosData = await videosResponse.json();

    if (!videosData.items) {
      return [];
    }

    return videosData.items.map(item => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      publishedAt: item.contentDetails.videoPublishedAt,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url || null
    }));
  } catch (error) {
    console.error(`Fehler beim Abrufen von Videos für Channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Holt Video-Details (für Dauer)
 */
export async function getVideoDetails(videoId) {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      const duration = parseDuration(item.contentDetails.duration);
      return {
        duration: duration, // in Sekunden
        viewCount: parseInt(item.statistics.viewCount) || 0
      };
    }
    return null;
  } catch (error) {
    console.error(`Fehler beim Abrufen von Video-Details für ${videoId}:`, error);
    return null;
  }
}

/**
 * Parst ISO 8601 Duration zu Sekunden
 */
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/* ============================================================
   INTERNAL HELPERS für Channel-Auflösung
   ============================================================ */

/**
 * Auflösung über offiziellen Handle-Endpunkt
 * (präzis, KEIN fuzzy search)
 */
async function resolveViaHandle(handle) {
  if (!YOUTUBE_API_KEY) return null;

  const url =
    `${YOUTUBE_API_BASE}/channels` +
    `?part=id&forHandle=${encodeURIComponent(handle)}` +
    `&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.items?.[0]?.id ?? null;
  } catch (error) {
    console.error(`Fehler bei Handle-Auflösung für ${handle}:`, error);
    return null;
  }
}

/**
 * Liest Channel-ID direkt aus HTML (Vanity / Sonderzeichen)
 * Versucht mehrere Patterns, da YouTube verschiedene Formate verwendet
 */
async function resolveViaHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      timeout: 10000
    });

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    
    // Versuche verschiedene Patterns für Channel-ID
    const patterns = [
      /"channelId":"(UC[a-zA-Z0-9_-]{22})"/,
      /"channelId":\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /channelId["\s]*:["\s]*(UC[a-zA-Z0-9_-]{22})/,
      /"externalId":"(UC[a-zA-Z0-9_-]{22})"/,
      /<link[^>]+rel="canonical"[^>]+href="[^"]*\/channel\/(UC[a-zA-Z0-9_-]{22})/,
      /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
      /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Versuche auch in JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData['@type'] === 'Person' || jsonData['@type'] === 'Organization') {
          const url = jsonData.url || jsonData.sameAs?.[0];
          if (url) {
            const channelMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
            if (channelMatch) {
              return channelMatch[1];
            }
          }
        }
      } catch (e) {
        // JSON-Parsing fehlgeschlagen, ignoriere
      }
    }

    return null;
  } catch (error) {
    // Fehler stillschweigend ignorieren, da dies ein Fallback ist
    return null;
  }
}

/**
 * Such-Fallback mit Verifikation:
 * - nimmt max. 5 Treffer
 * - vergleicht Namen / Handle / Custom URL
 * - KEIN Blindvertrauen
 */
async function searchAndVerify(query) {
  if (!YOUTUBE_API_KEY) return null;

  // Extrahiere Identifier aus URL falls vorhanden
  let searchQuery = query;
  if (query.includes('youtube.com')) {
    const cMatch = query.match(/\/c\/([^\/\s\?&#]+)/i);
    const userMatch = query.match(/\/user\/([^\/\s\?&#]+)/i);
    const handleMatch = query.match(/@([a-zA-Z0-9._-]+)/);
    
    if (cMatch) {
      searchQuery = cMatch[1];
    } else if (userMatch) {
      searchQuery = userMatch[1];
    } else if (handleMatch) {
      searchQuery = handleMatch[1];
    }
  }

  const url =
    `${YOUTUBE_API_BASE}/search` +
    `?part=snippet&type=channel&maxResults=5` +
    `&q=${encodeURIComponent(searchQuery)}` +
    `&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items?.length) return null;

    const normalizedQuery = normalize(searchQuery);

    for (const item of data.items) {
      const title = normalize(item.snippet.title || '');
      const customUrl = normalize(item.snippet.customUrl || '');
      const channelId = item.snippet.channelId;

      // Prüfe verschiedene Match-Kriterien
      if (
        title.includes(normalizedQuery) ||
        normalizedQuery.includes(title) ||
        customUrl.includes(normalizedQuery) ||
        normalizedQuery.includes(customUrl)
      ) {
        return channelId;
      }
    }

    return null;
  } catch (error) {
    console.error(`Fehler bei Search-Verifikation für ${query}:`, error);
    return null;
  }
}

/**
 * Normalisiert String für Vergleich (entfernt Diakritika, Sonderzeichen)
 */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
