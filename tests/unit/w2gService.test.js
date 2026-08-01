import { describe, expect, it } from '@jest/globals';
import { createW2GService, ConflictError } from '../../src/services/w2gService.js';

describe('TD-009 w2g service', () => {
  it('serializes parallel pushes and reuses the same idempotency key', async () => {
    const events = [];
    const fetchImpl = async (_url, options) => {
      events.push(options.body);
      return { ok: true, text: async () => JSON.stringify({ ok: true }) };
    };

    const service = createW2GService({ apiKey: 'abc', roomId: 'room1', dryRun: false, fetchImpl });
    const payload = [{ url: 'https://example.com/1', title: 'One' }];
    const first = await service.pushVideosToW2G(payload, { idempotencyKey: 'same' });
    const second = await service.pushVideosToW2G(payload, { idempotencyKey: 'same' });

    expect(first.job?.id).toBeTruthy();
    expect(second.job?.id).toBe(first.job?.id);
    expect(events).toHaveLength(1);
  });

  it('throws conflict for a different payload on the same idempotency key', async () => {
    const service = createW2GService({ apiKey: 'abc', roomId: 'room1', dryRun: true, fetchImpl: async () => ({ ok: true, text: async () => '{}' }) });
    await service.createPushJob([{ url: 'https://a', title: 'A' }], 'key');
    await expect(service.createPushJob([{ url: 'https://b', title: 'B' }], 'key')).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects empty payloads and wraps transport failures', async () => {
    const service = createW2GService({ apiKey: 'abc', roomId: 'room1', dryRun: false, fetchImpl: async () => { throw new Error('network down'); } });

    await expect(service.pushVideosToW2G([], { idempotencyKey: 'empty' })).rejects.toThrow('No videos to push');
    await expect(service.pushVideosToW2G([{ url: 'https://example.com', title: 'One' }], { idempotencyKey: 'fail' })).rejects.toThrow('W2G push failed');
  });
});
