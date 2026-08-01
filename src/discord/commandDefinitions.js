import { SlashCommandBuilder } from 'discord.js';

export function createCommandDefinitions() {
  const commands = [
    new SlashCommandBuilder()
      .setName('krustentv')
      .setDescription('KrüstchenTV Bot')
      .addSubcommand(sub => sub.setName('menu').setDescription('Hauptmenü öffnen'))
      .addSubcommand(sub => sub.setName('ping').setDescription('Bot-Test'))
      .addSubcommand(sub => sub.setName('help').setDescription('Hilfe anzeigen'))
      .addSubcommand(sub => sub.setName('version').setDescription('Aktuelle Bot-Version anzeigen'))
  ].map(cmd => cmd.toJSON());

  return commands;
}
