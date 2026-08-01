import { beforeEach, describe, it, expect } from '@jest/globals';
import { configureW2GService, getW2GRoomUrl, resetW2GService } from '../w2g_push.js';

describe('W2G room link', () => {
  beforeEach(() => {
    resetW2GService();
  });

  it('returns null when no service is configured', () => {
    expect(getW2GRoomUrl()).toBeNull();
  });

  it('builds a valid room URL when a service is configured', () => {
    configureW2GService({ roomId: 'abc123' });
    const url = getW2GRoomUrl();
    expect(url).toBe('https://w2g.tv/rooms/abc123');
  });
});
