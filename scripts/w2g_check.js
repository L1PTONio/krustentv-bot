import 'dotenv/config';
import * as w2g from '../w2g_push.js';

(async function main() {
  console.log('--- W2G Check ---');
  console.log('W2G_DRY_RUN:', process.env.W2G_DRY_RUN);
  console.log('W2G_FORCE_LIVE:', process.env.W2G_FORCE_LIVE);
  console.log('W2G_DEBUG:', process.env.W2G_DEBUG);

  try {
    const test = await w2g.testW2GConnection();
    console.log('[W2G TEST]', test);

    const playlist = await w2g.getCurrentPlaylist();
    console.log('[W2G PLAYLIST]', playlist);

    if (!test.success) process.exit(2);
    process.exit(0);
  } catch (error) {
    console.error('[W2G CHECK ERROR]', error.message || error);
    process.exit(1);
  }
})();