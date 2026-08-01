import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Routes } from 'discord.js';
import { createApplication } from '../../src/app/createApplication.js';
import { createCommandDefinitions } from '../../src/discord/commandDefinitions.js';
import { createLegacyBotController } from '../../src/discord/legacyBotController.js';

describe('TD-003 bootstrap factory', () => {
  let client;
  let rest;
  let logger;

  beforeEach(() => {
    client = {
      login: jest.fn(async () => true),
      destroy: jest.fn(async () => true)
    };
    rest = {
      put: jest.fn(async () => true)
    };
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  it('creates an application without triggering network calls during setup', async () => {
    const app = createApplication({
      config: { discord: { token: 'token', clientId: '123', guildId: null }, registerCommandsOnStart: false },
      client,
      rest,
      logger,
      commandDefinitions: createCommandDefinitions()
    });

    expect(app).toBeDefined();
    expect(client.login).not.toHaveBeenCalled();
    expect(rest.put).not.toHaveBeenCalled();
  });

  it('starts the client once and destroys it once', async () => {
    const app = createApplication({
      config: { discord: { token: 'token', clientId: '123', guildId: null }, registerCommandsOnStart: false },
      client,
      rest,
      logger,
      commandDefinitions: createCommandDefinitions()
    });

    await app.start();
    await app.start();
    await app.stop();
    await app.stop();

    expect(client.login).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it('registers commands for a guild when guildId is provided', async () => {
    const app = createApplication({
      config: { discord: { token: 'token', clientId: '123', guildId: 'guild-1' }, registerCommandsOnStart: true },
      client,
      rest,
      logger,
      commandDefinitions: createCommandDefinitions()
    });

    await app.registerCommands();

    expect(rest.put).toHaveBeenCalledWith(
      Routes.applicationGuildCommands('123', 'guild-1'),
      expect.anything()
    );
  });

  it('skips command registration when the client id is missing', async () => {
    const app = createApplication({
      config: { discord: { token: 'token', clientId: '', guildId: null }, registerCommandsOnStart: true },
      client,
      rest,
      logger,
      commandDefinitions: createCommandDefinitions()
    });

    await app.registerCommands();

    expect(rest.put).not.toHaveBeenCalled();
  });

  it('registers global commands with the application route helper', async () => {
    const app = createApplication({
      config: { discord: { token: 'token', clientId: '123', guildId: null }, registerCommandsOnStart: false },
      client,
      rest,
      logger,
      commandDefinitions: createCommandDefinitions()
    });

    await app.registerCommands();

    expect(rest.put).toHaveBeenCalledWith(
      Routes.applicationCommands('123'),
      expect.anything()
    );
  });

  it('creates a legacy controller that can attach handlers without network access', () => {
    const controller = createLegacyBotController({ client, logger });
    expect(typeof controller.attachHandlers).toBe('function');
    expect(() => controller.attachHandlers()).not.toThrow();
  });
});
