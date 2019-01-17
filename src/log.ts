import * as colors from 'colors/safe'
import * as moment from 'moment-timezone'
import * as winston from 'winston'
import * as DailyRotateFile from 'winston-daily-rotate-file'

const levels: { [level: string]: number } = {
  debug: 3,
  error: 0,
  info: 2,
  warn: 1,
}

const levelColors: { [level: string]: string } = {
  debug: 'green',
  error: 'red',
  info: 'blue',
  warn: 'yellow',
}

const appendLabel = winston.format((info, label?: string) => {
  if (label && label.length > 0) {
    info.label = label
  }

  return info
})

const format = winston.format.printf(info => {
  const color = levelColors[info.level]

  if (info.label) {
    info.level = `${info.label} ${info.level.toUpperCase()}`
  }

  // @ts-ignore: implicit any
  const convertColor = colors[color]
  if (typeof convertColor === 'function') {
    info.level = convertColor(info.level)
  }

  const timestamp = moment().format('HH:mm:ss.SSSS')

  return `${timestamp}\t${info.level}: ${info.message}`
})

const addLogger = (identifier: string, label?: string) => {
  if (!label) {
    label = identifier.toUpperCase()
  }

  return winston.loggers.add(identifier, {
    level: process.env.LOG_LEVEL || 'debug',
    levels,
    transports: [
      new DailyRotateFile({
        datePattern: 'DD-MM-YYYY',
        dirname: 'logs',
        filename: '%DATE%.log',
        format: winston.format.combine(format, winston.format.uncolorize()),
        maxFiles: '14d',
        zippedArchive: true,
      }),
      new winston.transports.Console({
        format: winston.format.combine(appendLabel(label), format),
      }),
    ],
  })
}

export default addLogger('egmrp-daemon')
