import { describe, expect, it } from '@jest/globals';
import { createInteractionRouter } from '../../src/discord/interactionRouter.js';

describe('interaction router', () => {
  it('dispatches slash commands to the main handler', async () => {
    const calls = [];
    const router = createInteractionRouter({
      handlers: {
        main: async interaction => { calls.push(interaction.commandName); return { ok: true }; },
        tv: async () => ({ ok: true }),
        admin: async () => ({ ok: true }),
        maintenance: async () => ({ ok: true })
      }
    });

    const result = await router.handleInteraction({ isChatInputCommand: () => true, commandName: 'help' });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['help']);
  });

  it('rejects malformed custom ids safely', async () => {
    const router = createInteractionRouter({ handlers: { main: async () => ({ ok: true }), tv: async () => ({ ok: true }), admin: async () => ({ ok: true }), maintenance: async () => ({ ok: true }) } });
    const result = await router.handleInteraction({ isButton: () => true, customId: ':::::' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Ungültige');
  });
});
