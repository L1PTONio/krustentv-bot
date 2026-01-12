export async function safeReply(interaction, options) {
  // options is the object passed to reply/editReply/followUp
  // priority: editReply (if deferred), followUp (if replied), reply otherwise
  if (!interaction) throw new Error('No interaction provided to safeReply');
  if (interaction.deferred) {
    return interaction.editReply(options);
  }
  if (interaction.replied) {
    return interaction.followUp(options);
  }
  return interaction.reply(options);
}

export async function safeDeferReply(interaction, options) {
  if (!interaction) throw new Error('No interaction provided to safeDeferReply');
  if (interaction.deferred || interaction.replied) return;
  return interaction.deferReply(options);
}

export async function safeDeferUpdate(interaction) {
  if (!interaction) throw new Error('No interaction provided to safeDeferUpdate');
  if (interaction.deferred || interaction.replied) return;
  return interaction.deferUpdate();
}
