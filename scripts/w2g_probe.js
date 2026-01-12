import 'dotenv/config';
import fetch from 'node-fetch';

const W2G_API_KEY = process.env.W2G_API_KEY;
const W2G_ROOM_ID = process.env.W2G_ROOM_ID;
const W2G_API_BASE = 'https://api.w2g.tv';
const ALLOW_POST = process.env.W2G_PROBE_ALLOW_POST === 'true';

function logResult(label, res, bodyText) {
  console.log(`\n--- ${label} ---`);
  console.log('status:', res.status, res.statusText);
  console.log('headers:', Object.fromEntries(res.headers.entries()));
  console.log('body:', bodyText);
}

async function tryGet(endpoint, headers = {}) {
  try {
    const res = await fetch(endpoint, { method: 'GET', headers });
    const text = await res.text();
    logResult(`GET ${endpoint}`, res, text);
    return { res, text };
  } catch (e) {
    console.error(`GET ${endpoint} failed:`, e.message);
    return { error: e };
  }
}

async function tryPost(endpoint, headers = {}, body = {}) {
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const text = await res.text();
    logResult(`POST ${endpoint}`, res, text);
    return { res, text };
  } catch (e) {
    console.error(`POST ${endpoint} failed:`, e.message);
    return { error: e };
  }
}

(async function main() {
  console.log('W2G probe starting...');
  if (!W2G_ROOM_ID) {
    console.error('W2G_ROOM_ID not set in env. Aborting.');
    process.exit(2);
  }

  const streamkey = W2G_ROOM_ID.trim();
  const baseRoom = `${W2G_API_BASE}/rooms/${streamkey}`;

  // Try simple room GET
  await tryGet(baseRoom, { Accept: 'application/json' });

  // Try GET playlist
  await tryGet(`${baseRoom}/playlists/current/playlist_items`, { Accept: 'application/json' });

  // Try GET playlist with API-Key as header variations
  if (W2G_API_KEY) {
    console.log('\nTrying GET with different auth header variants...');
    await tryGet(`${baseRoom}/playlists/current/playlist_items`, { Accept: 'application/json', Authorization: `Bearer ${W2G_API_KEY}` });
    await tryGet(`${baseRoom}/playlists/current/playlist_items`, { Accept: 'application/json', 'x-api-key': W2G_API_KEY });
    await tryGet(`${baseRoom}/playlists/current/playlist_items`, { Accept: 'application/json', 'x-w2g-api-key': W2G_API_KEY });
  } else {
    console.warn('W2G_API_KEY not set - skipping header-auth GETs');
  }

  // Optionally try a POST - disabled by default to avoid creating items unexpectedly
  if (!ALLOW_POST) {
    console.log('\nPOST probe is disabled. To enable, set W2G_PROBE_ALLOW_POST=true in your .env and re-run.');
    process.exit(0);
  }

  if (!W2G_API_KEY) {
    console.error('W2G_API_KEY required to attempt POST. Aborting.');
    process.exit(2);
  }

  const endpoint = `${baseRoom}/playlists/current/playlist_items/sync_update`;
  const testItem = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: `krustentv-probe-${Date.now()}` };

  console.log('\nTrying POST with body-based auth (w2g_api_key in body)');
  await tryPost(endpoint, {}, { w2g_api_key: W2G_API_KEY, add_items: [testItem] });

  console.log('\nTrying POST with Authorization: Bearer <key> header');
  await tryPost(endpoint, { Authorization: `Bearer ${W2G_API_KEY}` }, { add_items: [testItem] });

  console.log('\nTrying POST with x-api-key header');
  await tryPost(endpoint, { 'x-api-key': W2G_API_KEY }, { add_items: [testItem] });

  console.log('\nProbe finished.');
})();
