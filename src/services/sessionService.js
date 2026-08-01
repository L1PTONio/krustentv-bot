import { randomBytes } from 'node:crypto';

function createSessionId() {
  return randomBytes(8).toString('hex');
}

export function createSessionService({ repository, config = {} } = {}) {
  const defaultTtlMinutes = config.sessions?.ttlMinutes || 30;

  async function create({ guildId, userId, channelId, messageId, kind, initialState, ttlMinutes = defaultTtlMinutes }) {
    const session = {
      id: createSessionId(),
      guildId,
      userId,
      channelId,
      messageId,
      kind,
      status: 'active',
      version: 1,
      state: initialState || {},
      ttlMinutes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return repository.createSession(session);
  }

  async function get(sessionId) {
    return repository.getSession(sessionId);
  }

  async function update(sessionId, expectedVersion, updater) {
    const current = await repository.getSession(sessionId);
    if (!current) {
      throw new Error('Session not found');
    }
    if (current.version !== expectedVersion) {
      throw new Error('Session version conflict');
    }

    const nextState = typeof updater === 'function' ? updater(current.state) : updater;
    const updated = {
      ...current,
      state: nextState,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    return repository.updateSession(updated);
  }

  async function transition(sessionId, expectedStatus, nextStatus) {
    const current = await repository.getSession(sessionId);
    if (!current) {
      throw new Error('Session not found');
    }
    if (current.status !== expectedStatus) {
      throw new Error('Session status mismatch');
    }
    const updated = { ...current, status: nextStatus, version: current.version + 1, updatedAt: new Date().toISOString() };
    return repository.updateSession(updated);
  }

  async function claimAction(sessionId, actionKey) {
    return repository.claimAction(sessionId, actionKey);
  }

  async function complete(sessionId) {
    return repository.completeSession(sessionId);
  }

  async function expireOldSessions() {
    return repository.expireOldSessions?.();
  }

  return {
    create,
    get,
    update,
    transition,
    claimAction,
    complete,
    expireOldSessions
  };
}
