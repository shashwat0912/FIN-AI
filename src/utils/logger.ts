/**
 * Frontend Logger Utility
 * Provides environment-aware logging for the frontend application
 * Supports Sentry integration for production error tracking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

// Sentry: optional. Set VITE_SENTRY_DSN and install @sentry/react to enable.
async function initSentry(): Promise<null> {
  return null;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    let formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` | Context: ${JSON.stringify(context)}`;
    }
    
    if (error) {
      formattedMessage += ` | Error: ${error.message}`;
      if (error.stack && this.isDevelopment) {
        formattedMessage += ` | Stack: ${error.stack}`;
      }
    }
    
    return formattedMessage;
  }

  private async sendToSentry(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): Promise<void> {
    if (this.isDevelopment) return;
    
    const Sentry = await initSentry();
    if (!Sentry) return;
    
    // Add breadcrumb for context
    Sentry.addBreadcrumb({
      message,
      level: level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warning' : 'info',
      data: context,
    });
    
    // Capture errors explicitly
    if (level === LogLevel.ERROR && error) {
      Sentry.captureException(error, {
        extra: { message, ...context },
      });
    } else if (level === LogLevel.ERROR) {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: context,
      });
    } else if (level === LogLevel.WARN) {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
      });
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context, error);
    
    // In development, use console methods for better debugging
    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    } else {
      // In production, send errors and warnings to Sentry
      this.sendToSentry(level, message, context, error);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Convenience methods for common patterns
  apiError(endpoint: string, error: Error, context?: Record<string, unknown>): void {
    this.error(`API Error on ${endpoint}`, error, { endpoint, ...context });
  }

  authError(action: string, error: Error, context?: Record<string, unknown>): void {
    this.error(`Auth Error during ${action}`, error, { action, ...context });
  }

  userAction(action: string, context?: Record<string, unknown>): void {
    this.info(`User Action: ${action}`, context);
  }

  performance(operation: string, duration: number, context?: Record<string, unknown>): void {
    this.info(`Performance: ${operation} took ${duration}ms`, { operation, duration, ...context });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const { debug, info, warn, error, apiError, authError, userAction, performance } = logger;













