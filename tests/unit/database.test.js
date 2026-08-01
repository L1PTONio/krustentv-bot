import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, closeDatabase } from '../../src/db/database.js';
import { createMigrationRunner } from '../../src/db/migrationRunner.js';
import initialSchema from '../../src/db/migrations/001_initial_schema.js';

describe('TD-004 database migrations', () => {
  const tempFiles = [];

  afterEach(() => {
    for (const filePath of tempFiles.splice(0)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup issues
      }
    }
  });

  it('runs the initial migration idempotently', () => {
    const filePath = path.join(os.tmpdir(), `krustentv-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    tempFiles.push(filePath);

    const db = openDatabase(filePath);
    const runner = createMigrationRunner({ db, migrations: [initialSchema] });

    const first = runner.runMigrations();
    const second = runner.runMigrations();

    expect(first[0].applied).toBe(true);
    expect(second[0].applied).toBe(false);
    expect(second[0].skipped).toBe(true);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => row.name);
    expect(tables).toEqual(expect.arrayContaining(['channels', 'bot_state', 'schema_migrations']));

    runner.close();
    closeDatabase(db);
  });
});
