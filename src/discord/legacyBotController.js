export function createLegacyBotController({ client, logger = console } = {}) {
  function attachHandlers() {
    logger.info?.('Legacy bot controller attached');
    return { client };
  }

  return {
    attachHandlers
  };
}
