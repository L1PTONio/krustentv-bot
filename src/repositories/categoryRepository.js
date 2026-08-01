import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, closeDatabase } from '../db/database.js';
import { createMigrationRunner } from '../db/migrationRunner.js';
import categoryMigration from '../db/migrations/002_categories_schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_CATEGORIES_FILE = path.resolve(__dirname, '../../categories.json');

function normalizeCategoryName(name) {
  return (name || '').trim();
}

function normalizeChannelName(name) {
  return (name || '').trim();
}

export function createCategoryRepository({ db, migrationRunner = null } = {}) {
  const database = db || openDatabase();
  const runner = migrationRunner || createMigrationRunner({ db: database, migrations: [categoryMigration] });
  runner.runMigrations([categoryMigration]);

  function listCategories() {
    const rows = database.prepare('SELECT id, name FROM categories ORDER BY name').all();
    return rows.reduce((acc, row) => {
      acc[row.name] = { id: row.id, channels: {} };
      return acc;
    }, {});
  }

  function getCategory(name) {
    const category = database.prepare('SELECT id, name FROM categories WHERE name = ?').get(name);
    if (!category) {
      return null;
    }
    return { id: category.id, name: category.name, channels: {} };
  }

  function addCategory(name) {
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName) {
      throw new Error('Category name is required');
    }
    const existing = database.prepare('SELECT id FROM categories WHERE name = ?').get(normalizedName);
    if (existing) {
      throw new Error(`Kategorie "${normalizedName}" existiert bereits`);
    }
    const id = `cat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    database.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(id, normalizedName);
    return { id, name: normalizedName, channels: {} };
  }

  function renameCategory(oldName, newName) {
    const normalizedOld = normalizeCategoryName(oldName);
    const normalizedNew = normalizeCategoryName(newName);
    if (!normalizedOld || !normalizedNew) {
      throw new Error('Category names are required');
    }
    database.prepare('UPDATE categories SET name = ? WHERE name = ?').run(normalizedNew, normalizedOld);
  }

  function deleteCategory(name) {
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName) {
      throw new Error('Category name is required');
    }
    database.prepare('DELETE FROM categories WHERE name = ?').run(normalizedName);
  }

  function addChannelToCategory(categoryName, channelId, channelName) {
    const normalizedCategoryName = normalizeCategoryName(categoryName);
    const normalizedChannelId = (channelId || '').trim();
    const normalizedChannelName = normalizeChannelName(channelName);
    if (!normalizedCategoryName || !normalizedChannelId) {
      throw new Error('Category name and channel id are required');
    }

    const category = database.prepare('SELECT id FROM categories WHERE name = ?').get(normalizedCategoryName);
    if (!category) {
      throw new Error(`Kategorie "${normalizedCategoryName}" existiert nicht`);
    }

    database.prepare('INSERT OR REPLACE INTO category_channels (category_id, channel_id, channel_name) VALUES (?, ?, ?)')
      .run(category.id, normalizedChannelId, normalizedChannelName);
  }

  function removeChannelFromCategory(categoryName, channelId) {
    const normalizedCategoryName = normalizeCategoryName(categoryName);
    const normalizedChannelId = (channelId || '').trim();
    if (!normalizedCategoryName || !normalizedChannelId) {
      throw new Error('Category name and channel id are required');
    }

    const category = database.prepare('SELECT id FROM categories WHERE name = ?').get(normalizedCategoryName);
    if (!category) {
      throw new Error(`Kategorie "${normalizedCategoryName}" existiert nicht`);
    }

    database.prepare('DELETE FROM category_channels WHERE category_id = ? AND channel_id = ?').run(category.id, normalizedChannelId);
  }

  function getChannelsInCategory(categoryName) {
    const normalizedCategoryName = normalizeCategoryName(categoryName);
    if (!normalizedCategoryName) {
      return {};
    }
    const category = database.prepare('SELECT id FROM categories WHERE name = ?').get(normalizedCategoryName);
    if (!category) {
      return {};
    }

    const rows = database.prepare('SELECT channel_id, channel_name FROM category_channels WHERE category_id = ? ORDER BY channel_id').all(category.id);
    return rows.reduce((acc, row) => {
      acc[row.channel_id] = { name: row.channel_name };
      return acc;
    }, {});
  }

  async function importLegacyCategories() {
    try {
      const raw = await fs.readFile(LEGACY_CATEGORIES_FILE, 'utf8');
      const data = JSON.parse(raw);
      const categories = data.categories || {};
      for (const [name, entry] of Object.entries(categories)) {
        try {
          addCategory(name);
        } catch {
          // ignore duplicates
        }
        const category = getCategory(name);
        if (!category) {
          continue;
        }
        const channels = entry.channels || {};
        for (const [channelId, channelValue] of Object.entries(channels)) {
          addChannelToCategory(name, channelId, channelValue?.name || '');
        }
      }
    } catch {
      // no legacy data available
    }
  }

  return {
    listCategories,
    getCategory,
    addCategory,
    renameCategory,
    deleteCategory,
    addChannelToCategory,
    removeChannelFromCategory,
    getChannelsInCategory,
    importLegacyCategories,
    close() {
      if (db) {
        return;
      }
      closeDatabase(database);
    }
  };
}
