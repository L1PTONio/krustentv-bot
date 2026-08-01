export function buildMemberContext(interaction = {}) {
  const member = interaction.member || {};
  const guild = interaction.guild || {};
  const user = interaction.user || {};

  const roleIds = [];
  if (Array.isArray(member.roleIds)) {
    roleIds.push(...member.roleIds);
  } else if (member.roles?.cache) {
    roleIds.push(...member.roles.cache.map(role => role.id).filter(Boolean));
  }

  return {
    guildId: interaction.guildId || null,
    userId: user.id || null,
    roleIds,
    guildOwner: Boolean(guild.ownerId && user.id && guild.ownerId === user.id),
    manageGuild: Boolean(member.permissions?.has?.('ManageGuild') || member.permissions?.has?.('Administrator'))
  };
}
