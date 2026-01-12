import 'dotenv/config';
import * as youtube from '../youtube.js';
import * as w2g from '../w2g_push.js';

(async () => {
  console.log('--- KrüstchenTV Smoke Test ---');

  const DRY_RUN = process.env.W2G_DRY_RUN === 'true';
  if (DRY_RUN) console.log('[SMOKE] W2G_DRY_RUN=true → Keine echten W2G-POSTs');

  // Validate minimal envs
  const required = ['DISCORD_CLIENT_ID', 'DISCORD_TOKEN', 'YOUTUBE_API_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn('[SMOKE] Fehlende ENV für Smoke-Test:', missing.join(', '));
  }

  // Test YouTube resolution
  const sampleInput = process.env.SMOKE_CHANNEL_INPUT || 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw';
  console.log(`[SMOKE] Versuche Channel-Auflösung für: ${sampleInput}`);

  try {
    const channelId = await youtube.resolveChannelId(sampleInput);
    console.log(`[SMOKE] Channel-ID: ${channelId}`);

    const info = await youtube.getChannelInfo(channelId);
    console.log('[SMOKE] Channel-Info:', info);

    // Simuliere einen Push (nur Dry-Run oder echte, je nach ENV)
    const testItems = [
      { url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, title: 'Smoke Test Video' }
    ];

    console.log('[SMOKE] Teste Watch2Gether-Verbindung...');
    const testResult = await w2g.testW2GConnection();
    console.log('[SMOKE] W2G Test Result:', testResult);

    console.log('[SMOKE] Simulierter Push...');
    const pushResult = await w2g.pushVideosToW2G(testItems);
    console.log('[SMOKE] Push Result:', pushResult);

    console.log('--- Smoke Test: Erfolgreich ---');
  } catch (error) {
    console.error('[SMOKE] Fehler:', error.message || error);
    process.exit(1);
  }
})();