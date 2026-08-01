import { describe, expect, it } from '@jest/globals';
import { AppError, ValidationError, NotFoundError, ConflictError } from '../../src/utils/errors.js';

describe('error classes', () => {
  it('creates structured application errors', () => {
    const error = new ValidationError('bad input', { field: 'name' });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.field).toBe('name');
  });

  it('keeps the base error shape for other domains', () => {
    const error = new NotFoundError('missing');
    expect(error.name).toBe('NotFoundError');
  });

  it('supports conflict errors', () => {
    const error = new ConflictError('already exists');
    expect(error.code).toBe('CONFLICT');
  });

  it('inherits from AppError', () => {
    const error = new AppError('boom');
    expect(error.name).toBe('AppError');
  });
});
