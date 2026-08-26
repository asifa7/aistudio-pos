import { logger } from '../backend/logger';

export function logIPCCall(channel: string, args: any[], durationMs: number, error?: Error): void {
  const meta = {
    channel,
    arguments: args,
    durationMs,
    success: !error,
    ...(error ? { error: { name: error.name, message: error.message, stack: error.stack } } : {}),
  };

  if (error) {
    logger.error(`IPC Request Failure [Channel: ${channel}] in ${durationMs}ms`, error, meta);
  } else {
    logger.debug(`IPC Request Success [Channel: ${channel}] in ${durationMs}ms`, meta);
  }
}
