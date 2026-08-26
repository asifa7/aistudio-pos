export type ErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'HARDWARE_ERROR'
  | 'INVENTORY_ERROR'
  | 'PERMISSION_ERROR'
  | 'PRINTER_ERROR'
  | 'SCALE_ERROR'
  | 'CASH_ERROR'
  | 'AUTHENTICATION_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super('DATABASE_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super('NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, details);
  }
}

export class HardwareError extends AppError {
  constructor(message: string, details?: any) {
    super('HARDWARE_ERROR', message, details);
  }
}

export class InventoryError extends AppError {
  constructor(message: string, details?: any) {
    super('INVENTORY_ERROR', message, details);
  }
}

export class PermissionError extends AppError {
  constructor(message: string, details?: any) {
    super('PERMISSION_ERROR', message, details);
  }
}

export class PrinterError extends AppError {
  constructor(message: string, details?: any) {
    super('PRINTER_ERROR', message, details);
  }
}

export class ScaleError extends AppError {
  constructor(message: string, details?: any) {
    super('SCALE_ERROR', message, details);
  }
}

export class CashError extends AppError {
  constructor(message: string, details?: any) {
    super('CASH_ERROR', message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super('AUTHENTICATION_ERROR', message, details);
  }
}
