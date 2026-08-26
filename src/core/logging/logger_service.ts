import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ILogger } from './logger_interface';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class ConsoleLogger implements ILogger {
  private isDevelopment = process.env.NODE_ENV === 'development' || !app?.isPackaged;

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (this.isDevelopment) this.write('DEBUG', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.write('WARN', message, meta);
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const combinedMeta = {
      ...(error instanceof Error ? { error: { name: error.name, message: error.message, stack: error.stack } } : { error }),
      ...meta
    };
    this.write('ERROR', message, combinedMeta);
  }

  private write(level: LogLevel, message: string, meta?: any) {
    const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'DEBUG' ? '\x1b[36m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`${color}[${level}]${reset} ${message}`, meta || '');
  }
}

export class FileLogger implements ILogger {
  private logFilePath: string;

  constructor() {
    let logDir: string;
    try {
      logDir = path.join(app.getPath('userData'), 'logs');
    } catch {
      logDir = path.join(process.cwd(), 'logs');
    }

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create file log directory:', err);
    }
    this.logFilePath = path.join(logDir, 'app.log');
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.write('DEBUG', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.write('WARN', message, meta);
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const combinedMeta = {
      ...(error instanceof Error ? { error: { name: error.name, message: error.message, stack: error.stack } } : { error }),
      ...meta
    };
    this.write('ERROR', message, combinedMeta);
  }

  private write(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    const formatted = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    fs.appendFile(this.logFilePath, formatted, (err) => {
      if (err) {
        console.error('Failed to write to file log:', err);
      }
    });
  }
}

export class AuditLogger {
  public log(userId: number | null, action: string, details?: Record<string, unknown>): void {
    try {
      const { db } = require('../backend/db');
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (?, ?, ?)
      `).run(userId, action, details ? JSON.stringify(details) : null);
    } catch (err) {
      console.error('AuditLogger DB insert failed:', err);
    }
  }
}

// Composite logger that forwards logs to console and file loggers
export class CompositeLogger implements ILogger {
  constructor(private loggers: ILogger[]) {}

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.loggers.forEach(l => l.debug(message, meta));
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.loggers.forEach(l => l.info(message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.loggers.forEach(l => l.warn(message, meta));
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    this.loggers.forEach(l => l.error(message, error, meta));
  }
}

// Default instance exports matching the app's previous logging facade
const isDev = process.env.NODE_ENV === 'development' || !app?.isPackaged;
const consoleLogger = new ConsoleLogger();
const fileLogger = new FileLogger();

export const logger = new CompositeLogger(isDev ? [consoleLogger, fileLogger] : [fileLogger]);
export const auditLogger = new AuditLogger();
