import { errorTracker } from './error-tracker';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: unknown;
  error?: Error;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private writeIndex = 0;
  private count = 0;
  private minLevel: LogLevel = 'info';

  constructor() {
    if (import.meta.env.DEV) {
      this.minLevel = 'debug';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private normalizeError(error?: unknown): Error | undefined {
    if (!error) return undefined;
    if (error instanceof Error) return error;
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }

  private log(level: LogLevel, message: string, context?: unknown, error?: unknown) {
    if (!this.shouldLog(level)) return;

    const normalizedError = this.normalizeError(error);

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error: normalizedError,
    };

    this.logs[this.writeIndex] = entry;
    this.writeIndex = (this.writeIndex + 1) % this.maxLogs;
    if (this.count < this.maxLogs) this.count++;

    if (import.meta.env.DEV) {
      const formattedMessage = this.formatLogMessage(entry);

      /* eslint-disable no-console -- centralized logger uses raw console by design */
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, context);
          break;
        case 'info':
          console.info(formattedMessage, context);
          break;
        case 'warn':
          console.warn(formattedMessage, context);
          break;
        case 'error':
          console.error(formattedMessage, context, normalizedError);
          break;
      }
      /* eslint-enable no-console */
    }
  }

  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    return `[${timestamp}] [${level}] ${entry.message}`;
  }

  debug(message: string, context?: unknown) {
    this.log('debug', message, context);
  }

  info(message: string, context?: unknown) {
    this.log('info', message, context);
  }

  warn(message: string, context?: unknown) {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: unknown) {
    this.log('error', message, context, error);
    this.persistError(message, this.normalizeError(error), context);
  }

  private async persistError(message: string, error?: Error, _context?: unknown) {
    try {
      errorTracker.captureError({
        error_message: message,
        error_stack: error?.stack,
        error_type: 'console_error',
        severity: 'error',
        current_route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    } catch {
      // Avoid error loops
    }
  }

  private getOrderedLogs(): LogEntry[] {
    if (this.count < this.maxLogs) {
      return this.logs.slice(0, this.count);
    }
    return [...this.logs.slice(this.writeIndex), ...this.logs.slice(0, this.writeIndex)];
  }

  getLogs(level?: LogLevel): LogEntry[] {
    const ordered = this.getOrderedLogs();
    if (!level) return ordered;
    return ordered.filter((log) => log.level === level);
  }

  clearLogs() {
    this.logs = [];
    this.writeIndex = 0;
    this.count = 0;
  }

  exportLogs(): string {
    const ordered = this.getOrderedLogs();
    return JSON.stringify(ordered, (_key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack, name: value.name };
      }
      return value;
    }, 2);
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }
}

export const logger = new Logger();

const SENSITIVE_FIELD_NAMES = new Set([
  'password', 'password_hash', 'new_password', 'old_password', 'confirm_password',
  'token', 'access_token', 'refresh_token', 'id_token', 'api_key', 'secret', 'secret_key',
  'ssn', 'social_security_number', 'tax_id', 'ein',
  'dob', 'date_of_birth', 'birth_date', 'birthdate',
  'phone', 'phone_number', 'mobile', 'cell', 'fax', 'fax_number',
  'email', 'email_address',
  'address', 'street', 'street_address', 'address_line1', 'address_line2',
  'zip', 'zip_code', 'postal_code',
  'credit_card', 'card_number', 'cvv', 'expiry',
  'diagnosis', 'icd_code', 'chief_complaint', 'note_text', 'soap_note',
  'medication', 'prescription', 'allergy',
  'insurance_id', 'member_id', 'group_number', 'policy_number',
  'mrn', 'medical_record_number',
  'authorization', 'session_token', 'jwt',
]);

function redactSensitiveFields(value: unknown, depth = 0, visited = new WeakSet()): unknown {
  if (depth > 5) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if (visited.has(value as object)) return '[circular]';
    visited.add(value as object);
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitiveFields(item, depth + 1, visited));
  else if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveFields(val, depth + 1, visited);
      }
    }
    return result;
  }
  return value;
}

export function withLogging<T extends (...args: unknown[]) => unknown>(
  fn: T,
  functionName: string
): T {
  return ((...args: Parameters<T>) => {
    const safeArgs = args.map((a) => redactSensitiveFields(a));
    logger.debug(`Calling ${functionName}`, { args: safeArgs });
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result
          .then((value) => {
            logger.debug(`${functionName} completed successfully`);
            return value;
          })
          .catch((error) => {
            logger.error(`${functionName} failed`, error, { args: safeArgs });
            throw error;
          });
      }

      logger.debug(`${functionName} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`${functionName} failed`, error as Error, { args: safeArgs });
      throw error;
    }
  }) as T;
}
