import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { createFlowSessionStore } from '../../src/services/flowSessionStore.js';

describe('flow session store', () => {
  it('persists sessions to disk and guards duplicate actions', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'krustentv-flow-'));
    const storagePath = path.join(tempDir, 'sessions.json');

    try {
      const store = createFlowSessionStore({ storagePath });
      const session = await store.getSession('user-1');
      session.step = 'watchtime';
      await store.saveSession('user-1', session);

      const reloaded = createFlowSessionStore({ storagePath });
      const reloadedSession = await reloaded.getSession('user-1');
      expect(reloadedSession.step).toBe('watchtime');

      const lockAcquired = store.tryBeginAction('user-1', 'button:nav:main', 1000);
      expect(lockAcquired).toBe(true);
      expect(store.tryBeginAction('user-1', 'button:nav:main', 1000)).toBe(false);
      expect(store.tryBeginAction('user-1', 'button:nav:main', 1000)).toBe(false);
      store.finishAction('user-1', 'button:nav:main');
      const savedSession = await store.getSession('user-1');
      expect(savedSession.step).toBe('watchtime');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid user IDs and normalizes invalid sessions', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'krustentv-flow-'));
    const storagePath = path.join(tempDir, 'sessions.json');

    try {
      const store = createFlowSessionStore({ storagePath });
      await expect(store.getSession('   ')).rejects.toThrow('User ID is required');
      await expect(store.saveSession('user-2', null)).resolves.toBeUndefined();
      const session = await store.getSession('user-2');
      expect(session).toEqual({});
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
