import pino from 'pino'

export const logger = pino({
  base: null,
  level:
    process.env['LOG_LEVEL'] ??
    (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  transport: {
    target:
      process.env['NODE_ENV'] !== 'production' ? 'pino-pretty' : 'pino/file',
  },
})
