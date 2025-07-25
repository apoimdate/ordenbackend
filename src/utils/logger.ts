import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      },
  base: {
    env: process.env.NODE_ENV || 'development'
  },
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      'email',
      'phone'
    ],
    censor: '[REDACTED]'
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err
  },
  timestamp: pino.stdTimeFunctions.isoTime
});