import { describe, expect, it } from '@jest/globals';
import { createSessionService } from '../../src/services/sessionService.js';

describe('TD-010 session service', () => {
  it('creates and reuses sessions for distinct flows', async () => {
    const repository = {
      createSession: async ({ state }) => ({ id: 's1', version: 1, state, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ttlMinutes: 30 }),
      getSession: async () => null,
      updateSession: async () => ({ id: 's1', version: 2, state: { step: 'done' }, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ttlMinutes: 30 }),
      claimAction: async () => ({ claimed: true }),
      completeSession: async () => ({ id: 's1', status: 'completed' })
    };

    const service = createSessionService({ repository, config: { sessions: { ttlMinutes: 30 } } });
    const created = await service.create({ guildId: 'g1', userId: 'u1', channelId: 'c1', messageId: 'm1', kind: 'tv_flow', initialState: { step: 'start' } });
    expect(created.id).toBe('s1');
  });
});
