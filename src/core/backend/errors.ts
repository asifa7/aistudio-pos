import {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  HardwareError,
  InventoryError,
  PermissionError,
  PrinterError,
  ScaleError,
  CashError,
  AuthenticationError,
  ErrorCode
} from '../errors/app_errors';

export * from '../errors/app_errors';

// IPC Error Result format
export interface IPCErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    stack?: string;
  };
}

export interface IPCSuccessResponse<T> {
  success: true;
  data: T;
}

export type IPCResponse<T> = IPCSuccessResponse<T> | IPCErrorResponse;

/**
 * Safely wraps a backend function call, logging errors and returning a standard IPCResponse payload.
 */
export async function handleIPCRequest<T>(fn: () => Promise<T> | T): Promise<IPCResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error: any) {
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (error instanceof AppError) {
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error instanceof Error) {
      message = error.message;
    }

    const stack = error instanceof Error ? error.stack : undefined;
    return {
      success: false,
      error: {
        code,
        message,
        details,
        stack: process.env.NODE_ENV === 'production' ? undefined : stack,
      },
    };
  }
}

/**
 * Reconstructs an AppError subclass from an IPC response on the frontend.
 */
export function deserializeIPCResponse<T>(response: IPCResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  const { code, message, details } = response.error;
  switch (code) {
    case 'VALIDATION_ERROR':
      throw new ValidationError(message, details);
    case 'DATABASE_ERROR':
      throw new DatabaseError(message, details);
    case 'NOT_FOUND':
      throw new NotFoundError(message, details);
    case 'CONFLICT':
      throw new ConflictError(message, details);
    case 'HARDWARE_ERROR':
      throw new HardwareError(message, details);
    case 'INVENTORY_ERROR':
      throw new InventoryError(message, details);
    case 'PERMISSION_ERROR':
      throw new PermissionError(message, details);
    case 'PRINTER_ERROR':
      throw new PrinterError(message, details);
    case 'SCALE_ERROR':
      throw new ScaleError(message, details);
    case 'CASH_ERROR':
      throw new CashError(message, details);
    case 'AUTHENTICATION_ERROR':
      throw new AuthenticationError(message, details);
    default:
      throw new AppError(code, message, details);
  }
}
