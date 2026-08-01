import { describe, expect, it } from '@jest/globals';
import { createLogger, createErrorReporter } from '../../src/utils/logger.js';

describe('logger utilities', () => {
  it('creates a logger with structured metadata', () => {
    const logger = createLogger({ service: 'tests' });
    const entry = logger.info('hello', { foo: 'bar' });
    expect(entry.level).toBe('info');
    expect(entry.service).toBe('tests');
  });

  it('reports errors without throwing', () => {
    const reporter = createErrorReporter();
    const result = reporter(new Error('boom'));
    expect(result).toBeDefined();
  });
});
