export function createAuthorizationService({ config = {} } = {}) {
  let adminAllowAllMembers = Boolean(config.admin?.allowAllMembers);
  let adminUserIds = Array.isArray(config.admin?.userIds) ? config.admin.userIds : [];
  let adminRoleIds = Array.isArray(config.admin?.roleIds) ? config.admin.roleIds : [];

  function configure(nextConfig = {}) {
    adminAllowAllMembers = Boolean(nextConfig.admin?.allowAllMembers);
    adminUserIds = Array.isArray(nextConfig.admin?.userIds) ? nextConfig.admin.userIds : [];
    adminRoleIds = Array.isArray(nextConfig.admin?.roleIds) ? nextConfig.admin.roleIds : [];
  }

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

    if (getPolicyFor(action) !== 'admin') {
      return true;
    }

    return isAdminMember(member);
  }

  function getPolicyFor(action) {
    return action === 'admin.write' || action === 'maintenance.execute' || action === 'w2g.push' ? 'admin' : 'member';
  }

  return {
    can,
    isAdminMember,
    getPolicyFor,
    configure
  };
}
