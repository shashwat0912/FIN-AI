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

export default logger;
