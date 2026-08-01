export function createInteractionRouter({ handlers = {} } = {}) {
  async function handleInteraction(interaction) {
    if (interaction?.isChatInputCommand?.()) {
      const handler = handlers.main;
      if (typeof handler !== 'function') {
        return { ok: false, error: 'Kein Haupt-Handler vorhanden' };
      }
      return handler(interaction);
    }

    if (interaction?.isButton?.()) {
      const customId = interaction.customId;
      if (typeof customId !== 'string') {
        return { ok: false, error: 'Ungültige Button-ID' };
      }

      const parts = customId.split(':');
      if (parts.length < 3 || !parts[0] || !parts[1]) {
        return { ok: false, error: 'Ungültige Button-ID' };
      }

      const [scope] = parts;
      const handler = handlers[scope] ?? handlers.main;
      if (typeof handler !== 'function') {
        return { ok: false, error: `Kein Handler für Scope ${scope}` };
      }
      return handler(interaction, { scope });
    }

    if (interaction?.isModalSubmit?.()) {
      return handlers.main?.(interaction) ?? { ok: true };
    }

    return { ok: true };
  }

  return { handleInteraction };
}
