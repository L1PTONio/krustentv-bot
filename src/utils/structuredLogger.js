import { createLogger } from './logger.js';

export function createStructuredLogger(context = {}) {
  const logger = createLogger(context);

  return {
    debug: (message, metadata) => logger.debug(message, metadata),
    info: (message, metadata) => logger.info(message, metadata),
    warn: (message, metadata) => logger.warn(message, metadata),
    error: (message, metadata) => logger.error(message, metadata)
  };
}
