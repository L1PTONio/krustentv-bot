import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

export class DatabaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = options.cause;
  }
}

export function ensureDatabaseDirectory(filePath) {
  const directory = path.dirname(filePath);
  if (!directory || directory === '.') {
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
}

export function openDatabase(filePath = 'data/krustentv.sqlite') {
  ensureDatabaseDirectory(filePath);
  return new Database(filePath, { fileMustExist: false });
}

export function closeDatabase(db) {
  if (db && typeof db.close === 'function') {
    db.close();
  }
}
