export function createAuthorizationService({ config = {}, userRepository = null } = {}) {
  const adminAllowAllMembers = Boolean(config.admin?.allowAllMembers);
  const adminUserIds = Array.isArray(config.admin?.userIds) ? config.admin.userIds : [];
  const adminRoleIds = Array.isArray(config.admin?.roleIds) ? config.admin.roleIds : [];

  function isAdminMember(member = {}) {
    if (!member || typeof member !== 'object') {
      return false;
    }
    if (member.guildOwner) {
      return true;
    }
    if (member.manageGuild) {
      return true;
    }
    if (adminAllowAllMembers) {
      return true;
    }
    const userId = member.userId;
    if (userId && adminUserIds.includes(userId)) {
      return true;
    }
    const roleIds = Array.isArray(member.roleIds) ? member.roleIds : [];
    return roleIds.some(roleId => adminRoleIds.includes(roleId));
  }

  function can(action, member = {}) {
    if (!member?.guildId) {
      return false;
    }
    return isAdminMember(member);
  }

  function getPolicyFor(action) {
    return action === 'admin.write' || action === 'maintenance.execute' || action === 'w2g.push' ? 'admin' : 'member';
  }

  return {
    can,
    isAdminMember,
    getPolicyFor
  };
}
