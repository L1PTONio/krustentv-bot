function escapeValue(value) {
  return Buffer.from(String(value)).toString('base64url');
}

function unescapeValue(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}

function isSafeToken(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,64}$/.test(value);
}

export function buildCustomId({ namespace, action, sessionId, entityId }) {
  if (!isSafeToken(namespace) || !isSafeToken(action)) {
    throw new Error('Invalid custom id namespace or action');
  }
  const parts = [namespace, action];
  if (sessionId) {
    parts.push(escapeValue(sessionId));
  }
  if (entityId) {
    parts.push(escapeValue(entityId));
  }
  const value = parts.join(':');
  if (value.length > 100) {
    throw new Error('Custom id is too long');
  }
  return value;
}

export function parseCustomId(value) {
  if (typeof value !== 'string' || value.length > 100) {
    throw new Error('Invalid custom id');
  }
  const parts = value.split(':');
  if (parts.length < 2) {
    throw new Error('Invalid custom id');
  }
  const [namespace, action, ...rest] = parts;
  return {
    namespace,
    action,
    sessionId: rest[0] ? unescapeValue(rest[0]) : undefined,
    entityId: rest[1] ? unescapeValue(rest[1]) : undefined
  };
}
