export class AppError extends Error {
  constructor(message, { cause, code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code || 'APP_ERROR';
    this.details = details;
    this.cause = cause;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', details });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, { code: 'NOT_FOUND', details });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message, details) {
    super(message, { code: 'CONFLICT', details });
    this.name = 'ConflictError';
  }
}
