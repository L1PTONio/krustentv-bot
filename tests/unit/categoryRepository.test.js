import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../../src/db/database.js';
import { createCategoryRepository } from '../../src/repositories/categoryRepository.js';

describe('TD-005 category repository', () => {
  it('imports legacy categories and stores them in sqlite', async () => {
    const filePath = path.join(os.tmpdir(), `category-repo-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    const db = openDatabase(filePath);
    const repository = createCategoryRepository({ db });

    await repository.importLegacyCategories();

    const categories = repository.listCategories();
    expect(Object.keys(categories).length).toBeGreaterThan(0);
    expect(repository.getChannelsInCategory('memes')).toEqual({
      'UC7M_QoFOXa9MEVbfKSIeDSA': { name: 'Reaktions Hugo' },
      'UCdC0An4ZPNr_YiFiYoVbwaw': { name: 'Daily Dose Of Internet' },
      'UCKGMHVipEvuZudhHD05FOYA': { name: 'Simplicissimus' },
      'UCFgBYlz5LwymPSWBX-G6hBA': { name: '2 Bored Guys' },
      'UCpnkp_D4FLPCiXOmDhoAeYA': { name: 'UnusualVideos' }
    });

    db.close();
    fs.unlinkSync(filePath);
  });
});
