import { createLegacyBotController } from '../discord/legacyBotController.js';
import { createCommandDefinitions } from '../discord/commandDefinitions.js';

export function createApplication({
  config = {},
  client,
  rest,
  logger = console,
  commandDefinitions = createCommandDefinitions(),
  controllerFactory = createLegacyBotController
} = {}) {
  const effectiveConfig = {
    discord: {
      token: config.discord?.token || '',
      clientId: config.discord?.clientId || '',
      guildId: config.discord?.guildId || null
    },
    registerCommandsOnStart: config.registerCommandsOnStart !== false
  };

  const state = {
    started: false,
    stopped: false,
    controller: null
  };

  async function start() {
    if (state.started) {
      return;
    }

    state.started = true;
    state.stopped = false;

    if (client?.login) {
      await client.login(effectiveConfig.discord.token);
    }

    if (effectiveConfig.registerCommandsOnStart && rest?.put) {
      await registerCommands();
    }

    state.controller = controllerFactory({ client, logger });
    state.controller.attachHandlers();
    logger.info?.('Application started');
  }

  async function stop() {
    if (state.stopped) {
      return;
    }

    state.stopped = true;
    state.started = false;
    if (client?.destroy) {
      await client.destroy();
    }
    logger.info?.('Application stopped');
  }

  async function registerCommands() {
    if (!rest?.put) {
      return;
    }

    const body = Array.isArray(commandDefinitions) ? commandDefinitions : commandDefinitions();
    const route = effectiveConfig.discord.guildId
      ? `guilds/${effectiveConfig.discord.guildId}/commands`
      : 'applications/commands';

    await rest.put(route, { body });
    logger.info?.('Commands registered');
  }

  return {
    config: effectiveConfig,
    start,
    stop,
    registerCommands,
    getController: () => state.controller
  };
}
