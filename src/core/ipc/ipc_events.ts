import { ipcMain } from 'electron';
import { handleIPCRequest } from './ipc_errors';
import { checkIPCPermission } from './ipc_permissions';
import { logIPCCall } from './ipc_logger';

/**
 * Register an IPC handler in the main process with automatic permission validation,
 * performance instrumentation, execution timing metrics, and safe error packaging.
 */
export function registerIPCHandler<T>(
  channel: string,
  handler: (...args: any[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    const startTime = Date.now();
    try {
      // 1. Enforce Role-Based Access Control checks
      checkIPCPermission(channel);

      // 2. Call handler using standard errors serialization wrapper
      const result = await handleIPCRequest(async () => {
        // Safe extraction if args array is passed wrapped
        const payload = args[0];
        return handler(payload);
      });

      // 3. Profiler logging
      const durationMs = Date.now() - startTime;
      logIPCCall(channel, args, durationMs);

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logIPCCall(channel, args, durationMs, err);

      return {
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred',
          details: err.details,
          stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        },
      };
    }
  });
}
