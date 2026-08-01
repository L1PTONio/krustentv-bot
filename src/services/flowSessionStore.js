import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function normalizeUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('User ID is required');
  }
  return userId.trim();
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    return {};
  }
  return session;
}

export function createFlowSessionStore({ storagePath = 'data/flow-sessions.json' } = {}) {
  const activeActions = new Map();
  const memorySessions = new Map();

  async function ensureFile() {
    const directory = path.dirname(storagePath);
    await mkdir(directory, { recursive: true });
    try {
      await readFile(storagePath, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
      await writeFile(storagePath, '{}', 'utf8');
    }
  }

  async function loadSessions() {
    await ensureFile();
    const raw = await readFile(storagePath, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([userId, session]) => memorySessions.set(userId, session));
      }
    } catch {
      memorySessions.clear();
    }
  }

  async function persistSessions() {
    await ensureFile();
    const payload = Object.fromEntries(memorySessions.entries());
    await writeFile(storagePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  async function getSession(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!memorySessions.has(normalizedUserId)) {
      try {
        await loadSessions();
      } catch (error) {
        memorySessions.delete(normalizedUserId);
        throw new Error('Failed to load sessions', { cause: error });
      }
    }
    return memorySessions.get(normalizedUserId) || {};
  }

  async function saveSession(userId, session) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedSession = normalizeSession(session);
    memorySessions.set(normalizedUserId, normalizedSession);
    await persistSessions();
  }

  async function clearSession(userId) {
    const normalizedUserId = normalizeUserId(userId);
    memorySessions.delete(normalizedUserId);
    activeActions.delete(normalizedUserId);
    await persistSessions();
  }

  function tryBeginAction(userId, actionKey, ttlMs = 1000) {
    const normalizedUserId = normalizeUserId(userId);
    const now = Date.now();
    const current = activeActions.get(normalizedUserId);
    if (current && now - current.timestamp < ttlMs) {
      return false;
    }
    activeActions.set(normalizedUserId, { actionKey, timestamp: now });
    return true;
  }

  function finishAction(userId, actionKey) {
    const normalizedUserId = normalizeUserId(userId);
    const current = activeActions.get(normalizedUserId);
    if (current?.actionKey === actionKey) {
      activeActions.delete(normalizedUserId);
    }
  }

  return {
    loadSessions,
    getSession,
    saveSession,
    clearSession,
    tryBeginAction,
    finishAction
  };
}
