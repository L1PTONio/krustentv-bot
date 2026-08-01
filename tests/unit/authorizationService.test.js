import { describe, expect, it } from '@jest/globals';
import { createAuthorizationService } from '../../src/services/authorizationService.js';

describe('authorization service', () => {
  it('allows guild owner and role based admin access', () => {
    const service = createAuthorizationService({ config: { admin: { userIds: ['u1'], roleIds: ['r1'] } } });
    expect(service.can('admin.write', { guildId: 'g1', guildOwner: true })).toBe(true);
    expect(service.can('admin.write', { guildId: 'g1', userId: 'u1' })).toBe(true);
    expect(service.can('admin.write', { guildId: 'g1', roleIds: ['r1'] })).toBe(true);
  });

  it('allows regular members for non-admin actions and blocks dms', () => {
    const service = createAuthorizationService({ config: { admin: { userIds: [], roleIds: [] } } });
    expect(service.can('member.read', { guildId: 'g1', userId: 'u2' })).toBe(true);
    expect(service.can('admin.write', { guildId: 'g1', userId: 'u2' })).toBe(false);
    expect(service.can('admin.write', { guildId: null, userId: 'u2' })).toBe(false);
  });
});
