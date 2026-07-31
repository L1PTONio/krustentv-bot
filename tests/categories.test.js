import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as categories from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATEGORIES_FILE = join(__dirname, '..', 'categories.json');

let backup = null;

beforeAll(async () => {
  try {
    backup = await fs.readFile(CATEGORIES_FILE, 'utf-8');
  } catch {
    backup = null;
  }
  // start with a clean file
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify({ categories: {} }, null, 2), 'utf-8');
});

afterAll(async () => {
  if (backup === null) {
    await fs.unlink(CATEGORIES_FILE).catch(() => {});
  } else {
    await fs.writeFile(CATEGORIES_FILE, backup, 'utf-8');
  }
});

test('addCategory and getCategories', async () => {
  await categories.addCategory('test-cat');
  const all = await categories.getCategories();
  expect(all['test-cat']).toBeDefined();
});

test('addChannelToCategory and getChannelsInCategory', async () => {
  await categories.addChannelToCategory('test-cat', 'UC_TEST', 'Test Channel');
  const channels = await categories.getChannelsInCategory('test-cat');
  expect(channels['UC_TEST']).toBeDefined();
  expect(channels['UC_TEST'].name).toBe('Test Channel');
});

test('renameCategory and deleteCategory', async () => {
  await categories.renameCategory('test-cat', 'renamed-cat');
  const all = await categories.getCategories();
  expect(all['test-cat']).toBeUndefined();
  expect(all['renamed-cat']).toBeDefined();

  // Attempt to delete non-empty category should fail
  await expect(categories.deleteCategory('renamed-cat')).rejects.toThrow();

  // Remove channel and then delete
  await categories.removeChannelFromCategory('renamed-cat', 'UC_TEST');
  await categories.deleteCategory('renamed-cat');
  const refreshed = await categories.getCategories();
  expect(refreshed['renamed-cat']).toBeUndefined();
});
