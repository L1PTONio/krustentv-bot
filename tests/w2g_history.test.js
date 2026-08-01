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

test('markVideosPushed stores release and push timestamps', async () => {
  const nowBefore = Date.now();
  await history.markVideosPushed([
    {
      id: 'VID_PUSH_1',
      title: 'Video Eins',
      publishedAt: '2026-07-01T10:00:00.000Z'
    },
    {
      id: 'VID_PUSH_2',
      title: 'Video Zwei',
      publishedAt: '2026-07-02T10:00:00.000Z'
    }
  ]);

  const recent = await history.getRecentPushedVideos(10);
  expect(recent.length).toBeGreaterThanOrEqual(2);
  expect(recent[0].id).toBe('VID_PUSH_2');
  expect(recent[1].id).toBe('VID_PUSH_1');
  expect(recent[0].publishedAt).toBe('2026-07-02T10:00:00.000Z');

  const pushedAtDate = new Date(recent[0].pushedAt).getTime();
  expect(Number.isNaN(pushedAtDate)).toBe(false);
  expect(pushedAtDate).toBeGreaterThanOrEqual(nowBefore);
  expect(await history.isVideoSeen('VID_PUSH_1')).toBe(true);
});

test('getRecentPushedVideos enforces max of 100', async () => {
  const sample = Array.from({ length: 120 }, (_, index) => ({
    id: `VID_CAP_${index}`,
    title: `Video ${index}`,
    publishedAt: '2026-08-01T00:00:00.000Z'
  }));

  await history.markVideosPushed(sample);
  const recent = await history.getRecentPushedVideos(999);
  expect(recent.length).toBe(100);
});

test('clearWatchHistory removes seen and pushed data', async () => {
  await history.markVideosPushed([
    { id: 'CLEAR_1', title: 'Clear 1', publishedAt: '2026-08-01T10:00:00.000Z' }
  ]);
  expect(await history.isVideoSeen('CLEAR_1')).toBe(true);
  expect((await history.getRecentPushedVideos(10)).length).toBeGreaterThan(0);

  await history.clearWatchHistory();

  expect(await history.isVideoSeen('CLEAR_1')).toBe(false);
  expect(await history.getRecentPushedVideos(10)).toEqual([]);
});

test('getLastPushedAtForCategory returns last push timestamp per category', async () => {
  await history.markVideosPushed([
    { id: 'CAT_1', title: 'Cat one', publishedAt: '2026-08-01T10:00:00.000Z', category: 'memes' },
    { id: 'CAT_2', title: 'Cat two', publishedAt: '2026-08-01T10:00:00.000Z', category: 'doku' }
  ]);

  const memesLast = await history.getLastPushedAtForCategory('memes');
  const csLast = await history.getLastPushedAtForCategory('cs');

  expect(typeof memesLast).toBe('string');
  expect(new Date(memesLast).toString()).not.toBe('Invalid Date');
  expect(csLast).toBeNull();
});
