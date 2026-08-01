import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase, closeDatabase, DatabaseError } from './database.js';

export function createMigrationRunner({ db, migrations = [] } = {}) {
  const database = db || openDatabase();
  const migrationTableName = 'schema_migrations';

  database.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationTableName} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  function getAppliedVersions() {
    const rows = database.prepare(`SELECT version FROM ${migrationTableName} ORDER BY version`).all();
    return new Set(rows.map(row => row.version));
  }

  function markApplied(version) {
    database.prepare(`INSERT INTO ${migrationTableName} (version, applied_at) VALUES (?, ?)`).run(version, new Date().toISOString());
  }

  function runMigration(migration) {
    if (!migration || typeof migration.version !== 'string' || typeof migration.up !== 'function') {
      throw new DatabaseError('Invalid migration definition');
    }

    if (migration.down) {
      // down is optional and ignored for the runtime runner
    }

    const applied = getAppliedVersions();
    if (applied.has(migration.version)) {
      return { applied: false, skipped: true, version: migration.version };
    }

    database.exec('BEGIN');
    try {
      migration.up(database);
      markApplied(migration.version);
      database.exec('COMMIT');
      return { applied: true, skipped: false, version: migration.version };
    } catch (error) {
      database.exec('ROLLBACK');
      throw new DatabaseError(`Migration ${migration.version} failed`, { cause: error });
    }
  }

  function runMigrations(migrationList = migrations) {
    const results = [];
    for (const migration of migrationList) {
      results.push(runMigration(migration));
    }
    return results;
  }

  return {
    runMigration,
    runMigrations,
    getAppliedVersions,
    close() {
      if (db) {
        return;
      }
      closeDatabase(database);
    }
  };
}

export async function loadMigrationsFromDirectory(directory) {
  if (!directory || !fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();

  const migrations = [];
  for (const fileName of entries) {
    const modulePath = path.resolve(directory, fileName);
    const migrationModule = await import(pathToFileURL(modulePath).href);
    migrations.push(migrationModule.default || migrationModule);
  }

  return migrations;
}
