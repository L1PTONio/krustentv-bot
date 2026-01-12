import { describe, it, expect } from '@jest/globals';
import { getW2GRoomUrl } from '../w2g_push.js';

describe('W2G room link', () => {
  it('returns null when no env set', () => {
    const prev = process.env.W2G_ROOM_ID;
    delete process.env.W2G_ROOM_ID;
    const url = getW2GRoomUrl();
    expect(url).toBeNull();
    if (prev) process.env.W2G_ROOM_ID = prev;
  });

  it('builds a valid room URL when env set', () => {
    const prev = process.env.W2G_ROOM_ID;
    process.env.W2G_ROOM_ID = 'abc123';
    const url = getW2GRoomUrl();
    expect(url).toBe('https://w2g.tv/rooms/abc123');
    if (prev) process.env.W2G_ROOM_ID = prev; else delete process.env.W2G_ROOM_ID;
  });
});
