import { describe, expect, it } from '@jest/globals';
import { buildMemberContext } from '../../src/discord/memberContext.js';

describe('buildMemberContext', () => {
  it('extracts guild membership data for authorization checks', () => {
    const interaction = {
      user: { id: 'u1' },
      guildId: 'g1',
      guild: { ownerId: 'u1' },
      member: {
        user: { id: 'u1' },
        roles: { cache: [{ id: 'r1' }, { id: 'r2' }] },
        permissions: { has: () => true }
      }
    };

    const context = buildMemberContext(interaction);
    expect(context.guildId).toBe('g1');
    expect(context.userId).toBe('u1');
    expect(context.roleIds).toEqual(['r1', 'r2']);
    expect(context.guildOwner).toBe(true);
    expect(context.manageGuild).toBe(true);
  });
});
