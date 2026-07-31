import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const isProduction = process.env.NODE_ENV === 'production';
const transports: winston.transport[] = [
  new winston.transports.Console({ stderrLevels: ['error'] }),
];

if (!isProduction && process.env.LOG_FILE) {
  transports.push(new winston.transports.File({
    filename: process.env.LOG_FILE,
    maxsize: 5242880,
    maxFiles: 5,
  }));
}

async function initSentryTransport(): Promise<winston.transport | null> {
  const sentryDsn = process.env.SENTRY_DSN;
  if (!sentryDsn || process.env.NODE_ENV !== 'production') return null;
  
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // Capture 10% of transactions
    });
    
    // Create a custom Winston transport that sends errors to Sentry
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format((info) => {
          if (info.level === 'error') {
            Sentry.captureException(info.message instanceof Error ? info.message : new Error(info.message as string), {
              extra: info,
            });
          } else if (info.level === 'warn') {
            Sentry.captureMessage(info.message as string, 'warning');
          }
          return false; // Don't actually log to console
        })()
      ),
      level: 'error',
    });
  } catch (error) {
    // Sentry not installed, continue without it
    return null;
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? logFormat
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
  defaultMeta: { service: 'finance-ai-backend' },
  transports,
});

// Initialize Sentry in production (async)
if (process.env.NODE_ENV === 'production') {
  initSentryTransport().then((transport) => {
    if (transport) {
      logger.add(transport);
      logger.info('Sentry error monitoring initialized');
    }
  });
}

export default logger;

// Export Sentry initialization for use in other files
export { initSentryTransport };
