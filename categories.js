import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATEGORIES_FILE = join(__dirname, 'categories.json');

/**
 * Lädt die Categories-Datei
 */
async function loadCategories() {
  try {
    const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { categories: {} };
  }
}

/**
 * Speichert die Categories-Datei
 */
async function saveCategories(categories) {
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
}

/**
 * Holt alle Kategorien
 */
export async function getCategories() {
  const data = await loadCategories();
  return data.categories || {};
}

/**
 * Fügt eine Kategorie hinzu
 */
export async function addCategory(name) {
  const data = await loadCategories();
  if (!data.categories) {
    data.categories = {};
  }
  if (data.categories[name]) {
    throw new Error(`Kategorie "${name}" existiert bereits`);
  }
  data.categories[name] = { channels: {} };
  await saveCategories(data);
  return data.categories[name];
}

/**
 * Benennt eine Kategorie um
 */
export async function renameCategory(oldName, newName) {
  const data = await loadCategories();
  if (!data.categories[oldName]) {
    throw new Error(`Kategorie "${oldName}" existiert nicht`);
  }
  if (data.categories[newName]) {
    throw new Error(`Kategorie "${newName}" existiert bereits`);
  }
  data.categories[newName] = data.categories[oldName];
  delete data.categories[oldName];
  await saveCategories(data);
}

/**
 * Löscht eine Kategorie (nur wenn leer)
 */
export async function deleteCategory(name) {
  const data = await loadCategories();
  if (!data.categories[name]) {
    throw new Error(`Kategorie "${name}" existiert nicht`);
  }
  const channels = Object.keys(data.categories[name].channels || {});
  if (channels.length > 0) {
    throw new Error(`Kategorie "${name}" ist nicht leer (${channels.length} Channels)`);
  }
  delete data.categories[name];
  await saveCategories(data);
}

/**
 * Fügt einen Channel zu einer Kategorie hinzu
 */
export async function addChannelToCategory(categoryName, channelId, channelName) {
  const data = await loadCategories();
  if (!data.categories[categoryName]) {
    throw new Error(`Kategorie "${categoryName}" existiert nicht`);
  }
  if (!data.categories[categoryName].channels) {
    data.categories[categoryName].channels = {};
  }
  data.categories[categoryName].channels[channelId] = { name: channelName };
  await saveCategories(data);
}

/**
 * Entfernt einen Channel aus einer Kategorie
 */
export async function removeChannelFromCategory(categoryName, channelId) {
  const data = await loadCategories();
  if (!data.categories[categoryName]) {
    throw new Error(`Kategorie "${categoryName}" existiert nicht`);
  }
  if (!data.categories[categoryName].channels || !data.categories[categoryName].channels[channelId]) {
    throw new Error(`Channel "${channelId}" existiert nicht in Kategorie "${categoryName}"`);
  }
  delete data.categories[categoryName].channels[channelId];
  await saveCategories(data);
}

/**
 * Holt alle Channels einer Kategorie
 */
export async function getChannelsInCategory(categoryName) {
  const data = await loadCategories();
  if (!data.categories[categoryName]) {
    return {};
  }
  return data.categories[categoryName].channels || {};
}
