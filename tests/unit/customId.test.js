import { describe, expect, it } from '@jest/globals';
import { buildCustomId, parseCustomId } from '../../src/utils/customId.js';

describe('custom id codec', () => {
  it('builds and parses short custom ids', () => {
    const id = buildCustomId({ namespace: 'tv', action: 'confirm', sessionId: 'session-1', entityId: 'video-1' });
    expect(id).toContain('tv:confirm');
    const parsed = parseCustomId(id);
    expect(parsed.sessionId).toBe('session-1');
    expect(parsed.entityId).toBe('video-1');
  });

  it('rejects overlong values', () => {
    expect(() => buildCustomId({ namespace: 'tv', action: 'confirm', sessionId: 'x'.repeat(200) })).toThrow();
  });
});
