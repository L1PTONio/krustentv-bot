import { deepFreeze } from '../utils/deepFreeze.js';

export class ConfigValidationError extends Error {
  constructor(errors) {
    super('Invalid configuration');
    this.name = 'ConfigValidationError';
    this.errors = Array.isArray(errors) ? errors : [];
    this.message = this.formatMessage();
  }

  formatMessage() {
    if (this.errors.length === 0) {
      return 'Invalid configuration';
    }
    return this.errors.map(err => `${err.field}: ${err.message}`).join('; ');
  }
}

function normalizeString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseRequiredString(env, envVar, field, options = {}) {
  const aliases = Array.isArray(options.aliases) ? options.aliases : [];
  const value = normalizeString(resolveEnvValue(env, [envVar, ...aliases]));
  if (value === undefined) {
    throw createFieldError(field, envVar, options.message || 'is required');
  }
  return value;
}

function parseOptionalString(env, envVar, field, options = {}) {
  const aliases = Array.isArray(options.aliases) ? options.aliases : [];
  const value = normalizeString(resolveEnvValue(env, [envVar, ...aliases]));
  if (value === undefined) {
    return options.defaultValue;
  }
  return value;
}

function parseBoolean(env, envVar, field, defaultValue = false, options = {}) {
  const aliases = Array.isArray(options.aliases) ? options.aliases : [];
  const value = resolveEnvValue(env, [envVar, ...aliases]);
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  throw createFieldError(field, envVar, 'must be a boolean value');
}

function parsePositiveInteger(env, envVar, field, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = env[envVar];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      if (parsed > 0 && parsed <= max) {
        return parsed;
      }
    }
  }

  throw createFieldError(field, envVar, `must be a positive integer between ${min} and ${max}`);
}

function parseCsvIds(env, envVar, field, defaultValue = []) {
  const value = env[envVar];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value !== 'string') {
    throw createFieldError(field, envVar, 'must be a comma-separated string');
  }

  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);

  for (const item of items) {
    if (!/^\d+$/.test(item)) {
      throw createFieldError(field, envVar, `contains invalid Discord ID ${item}`);
    }
  }

  return deepFreeze(items);
}

function parseIsoDate(env, envVar, field) {
  const value = normalizeString(env[envVar]);
  if (value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createFieldError(field, envVar, 'must be a valid ISO-8601 date');
  }
  return parsed;
}

function createFieldError(field, envVar, message) {
  return { field, envVar, message };
}

function resolveEnvValue(env, names) {
  for (const name of names) {
    const value = env?.[name];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function buildConfigFromEnv(env, options = {}) {
  const strict = options.strict !== false;
  const errors = [];

  const parse = (reader) => {
    try {
      return reader();
    } catch (error) {
      if (error && Array.isArray(error.errors)) {
        errors.push(...error.errors);
      } else if (error && error.field) {
        errors.push(error);
      }
      return undefined;
    }
  };

  const nodeEnv = parse(() => parseOptionalString(env, 'NODE_ENV', 'nodeEnv', { defaultValue: 'development' })) || 'development';
  const discordToken = parse(() => parseRequiredString(env, 'DISCORD_TOKEN', 'discord.token', { message: 'is required', aliases: ['BOT_TOKEN'] }));
  const discordClientId = parse(() => parseRequiredString(env, 'DISCORD_CLIENT_ID', 'discord.clientId', { message: 'is required', aliases: ['CLIENT_ID'] }));
  const discordGuildId = parse(() => parseOptionalString(env, 'DISCORD_GUILD_ID', 'discord.guildId'));

  const youtubeApiKey = parse(() => parseRequiredString(env, 'YOUTUBE_API_KEY', 'youtube.apiKey', { message: 'is required', aliases: ['YOUTUBE_KEY'] }));
  const youtubeRequestTimeoutMs = parse(() => parsePositiveInteger(env, 'YOUTUBE_REQUEST_TIMEOUT_MS', 'youtube.requestTimeoutMs', 10000, { max: 600000 }));

  const w2gApiKey = parse(() => parseOptionalString(env, 'W2G_API_KEY', 'w2g.apiKey', { aliases: ['W2G_KEY'] }));
  const w2gRoomId = parse(() => parseOptionalString(env, 'W2G_ROOM_ID', 'w2g.roomId', { aliases: ['ROOM_ID'] }));
  let w2gDryRun = parse(() => parseBoolean(env, 'W2G_DRY_RUN', 'w2g.dryRun', false, { aliases: ['DRY_RUN'] }));
  const w2gForceLive = parse(() => parseBoolean(env, 'W2G_FORCE_LIVE', 'w2g.forceLive', false));
  const w2gRequestTimeoutMs = parse(() => parsePositiveInteger(env, 'W2G_REQUEST_TIMEOUT_MS', 'w2g.requestTimeoutMs', 10000, { max: 600000 }));
  const w2gMinRequestIntervalMs = parse(() => parsePositiveInteger(env, 'W2G_MIN_REQUEST_INTERVAL_MS', 'w2g.minRequestIntervalMs', 1000, { max: 600000 }));
  const w2gDebug = parse(() => parseBoolean(env, 'W2G_DEBUG', 'w2g.debug', false));

  const databasePath = parse(() => parseOptionalString(env, 'DATABASE_PATH', 'database.path', { defaultValue: 'data/krustentv.sqlite' }));
  const minPublishedAt = parse(() => parseIsoDate(env, 'MIN_VIDEO_PUBLISHED_AT', 'video.minPublishedAt'));
  const adminUserIds = parse(() => parseCsvIds(env, 'ADMIN_USER_IDS', 'admin.userIds', []));
  const adminRoleIds = parse(() => parseCsvIds(env, 'ADMIN_ROLE_IDS', 'admin.roleIds', []));
  const adminAllowAllMembers = parse(() => parseBoolean(env, 'ADMIN_ALLOW_ALL_MEMBERS', 'admin.allowAllMembers', false));
  const sessionTtlMinutes = parse(() => parsePositiveInteger(env, 'SESSION_TTL_MINUTES', 'sessions.ttlMinutes', 60, { max: 10080 }));

  const normalizedW2gRoomId = w2gRoomId ? w2gRoomId.trim() : undefined;
  if (normalizedW2gRoomId && !/^[a-zA-Z0-9_-]+$/.test(normalizedW2gRoomId)) {
    errors.push(createFieldError('w2g.roomId', 'W2G_ROOM_ID', 'must only contain letters, numbers, dash or underscore'));
  }

  if (strict) {
    if (w2gForceLive) {
      if (!w2gApiKey) {
        errors.push(createFieldError('w2g.apiKey', 'W2G_API_KEY', 'is required when forceLive is enabled'));
      }
      if (!normalizedW2gRoomId) {
        errors.push(createFieldError('w2g.roomId', 'W2G_ROOM_ID', 'is required when forceLive is enabled'));
      }
      w2gDryRun = false;
    } else if (!w2gDryRun) {
      if (!w2gApiKey) {
        errors.push(createFieldError('w2g.apiKey', 'W2G_API_KEY', 'is required in live mode'));
      }
      if (!normalizedW2gRoomId) {
        errors.push(createFieldError('w2g.roomId', 'W2G_ROOM_ID', 'is required in live mode'));
      }
    }

    if (!discordToken) {
      errors.push(createFieldError('discord.token', 'DISCORD_TOKEN', 'is required'));
    }
    if (!discordClientId) {
      errors.push(createFieldError('discord.clientId', 'DISCORD_CLIENT_ID', 'is required'));
    }
    if (!youtubeApiKey) {
      errors.push(createFieldError('youtube.apiKey', 'YOUTUBE_API_KEY', 'is required'));
    }
  }

  const config = {
    nodeEnv,
    discord: {
      token: discordToken,
      clientId: discordClientId,
      guildId: discordGuildId
    },
    youtube: {
      apiKey: youtubeApiKey,
      requestTimeoutMs: youtubeRequestTimeoutMs
    },
    w2g: {
      apiKey: w2gApiKey,
      roomId: normalizedW2gRoomId,
      dryRun: w2gDryRun,
      forceLive: w2gForceLive,
      requestTimeoutMs: w2gRequestTimeoutMs,
      minRequestIntervalMs: w2gMinRequestIntervalMs,
      debug: w2gDebug
    },
    database: {
      path: databasePath
    },
    video: {
      minPublishedAt: minPublishedAt
    },
    admin: {
      userIds: adminUserIds,
      roleIds: adminRoleIds,
      allowAllMembers: adminAllowAllMembers
    },
    sessions: {
      ttlMinutes: sessionTtlMinutes
    }
  };

  if (strict && errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  return deepFreeze(config);
}

export function loadConfig(env = process.env, options = {}) {
  return buildConfigFromEnv(env || {}, options);
}

export function redactConfig(config) {
  const base = {
    nodeEnv: config.nodeEnv,
    discord: {
      tokenConfigured: Boolean(config.discord?.token),
      clientId: config.discord?.clientId,
      guildId: config.discord?.guildId
    },
    youtube: {
      apiKeyConfigured: Boolean(config.youtube?.apiKey)
    },
    w2g: {
      apiKeyConfigured: Boolean(config.w2g?.apiKey),
      roomIdConfigured: Boolean(config.w2g?.roomId),
      dryRun: config.w2g?.dryRun,
      forceLive: config.w2g?.forceLive,
      debug: config.w2g?.debug,
      requestTimeoutMs: config.w2g?.requestTimeoutMs,
      minRequestIntervalMs: config.w2g?.minRequestIntervalMs
    },
    database: {
      path: config.database?.path
    },
    video: {
      minPublishedAt: config.video?.minPublishedAt ? config.video.minPublishedAt.toISOString() : null
    },
    admin: {
      userCount: Array.isArray(config.admin?.userIds) ? config.admin.userIds.length : 0,
      roleCount: Array.isArray(config.admin?.roleIds) ? config.admin.roleIds.length : 0,
      allowAllMembers: config.admin?.allowAllMembers
    },
    sessions: {
      ttlMinutes: config.sessions?.ttlMinutes
    }
  };

  return deepFreeze(base);
}
