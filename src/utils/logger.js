export function createLogger(context = {}) {
  function log(level, message, metadata = {}) {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
      ...metadata
    };
    return entry;
  }

  return {
    debug: (message, metadata) => log('debug', message, metadata),
    info: (message, metadata) => log('info', message, metadata),
    warn: (message, metadata) => log('warn', message, metadata),
    error: (message, metadata) => log('error', message, metadata)
  };
}

export function createErrorReporter(context = {}) {
  const logger = createLogger(context);
  return error => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    return logger.error(normalized.message, { stack: normalized.stack });
  };
}
