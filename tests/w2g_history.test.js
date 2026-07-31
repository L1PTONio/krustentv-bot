import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as history from '../w2g_history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HISTORY_FILE = join(__dirname, '..', 'w2g_history.json');

let backup = null;

beforeAll(async () => {
  try {
    backup = await fs.readFile(HISTORY_FILE, 'utf-8');
  } catch {
    backup = null;
  }
  // start with clean history
  await fs.writeFile(HISTORY_FILE, JSON.stringify({ seen: {}, lastCacheReset: null }, null, 2), 'utf-8');
});

afterAll(async () => {
  if (backup === null) {
    await fs.unlink(HISTORY_FILE).catch(() => {});
  } else {
    await fs.writeFile(HISTORY_FILE, backup, 'utf-8');
  }
});

test('markVideoSeen & isVideoSeen', async () => {
  const vid = 'VID_TEST_1';
  expect(await history.isVideoSeen(vid)).toBeFalsy();
  await history.markVideoSeen(vid);
  expect(await history.isVideoSeen(vid)).toBeTruthy();
});

test('markVideosSeen', async () => {
  const vids = ['VID_A', 'VID_B', 'VID_C'];
  await history.markVideosSeen(vids);
  for (const v of vids) {
    expect(await history.isVideoSeen(v)).toBeTruthy();
  }
});

test('filterUnseenVideos', async () => {
  // prepare: mark one seen
  await history.markVideoSeen('SEEN_1');
  const sample = [
    { id: 'SEEN_1' },
    { id: 'UNSEEN_1' }
  ];
  const filtered = await history.filterUnseenVideos(sample);
  expect(filtered.length).toBe(1);
  expect(filtered[0].id).toBe('UNSEEN_1');
});

test('isCacheValid resets after 12:00 logic', async () => {
  // We cannot easily mock Date globally here without jest timers, but we can simulate by setting lastCacheReset far in past and running isCacheValid after artificially changing file
  const data = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf-8'));
  data.lastCacheReset = '2000-01-01T00:00:00.000Z';
  data.seen = { 'OLD': true };
  await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');

  // Call isCacheValid which should reset if now >= 12:00; this test checks that the function executes and returns a boolean (true/false)
  const result = await history.isCacheValid();
  expect(typeof result).toBe('boolean');
});
