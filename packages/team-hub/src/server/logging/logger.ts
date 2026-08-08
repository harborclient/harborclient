import winston from 'winston';
import type { LoggingConfig } from '#/config/loggingConfig.js';

/**
 * Winston logger instance used by the Team Hub server.
 */
export type Logger = winston.Logger;

/**
 * Builds the Winston format pipeline for the configured output style.
 *
 * @param format - `json` for machine parsing or `simple` for local terminals.
 * @returns Combined Winston format including timestamps.
 */
function buildLoggerFormat(format: LoggingConfig['format']): winston.Logform.Format {
  if (format === 'simple') {
    return winston.format.combine(winston.format.timestamp(), winston.format.simple());
  }

  return winston.format.combine(winston.format.timestamp(), winston.format.json());
}

/**
 * Builds a Winston logger from normalized logging configuration.
 *
 * Uses standard npm log levels. When both file and console output are disabled,
 * attaches a silent console transport so Winston does not warn about zero transports.
 *
 * @param config - Normalized logging settings from server.yaml.
 * @returns Configured Winston logger.
 */
export function createLogger(config: LoggingConfig): Logger {
  const transports: winston.transport[] = [];

  if (config.console) {
    transports.push(new winston.transports.Console());
  }

  if (config.file) {
    transports.push(new winston.transports.File({ filename: config.file }));
  }

  if (transports.length === 0) {
    transports.push(new winston.transports.Console({ silent: true }));
  }

  return winston.createLogger({
    level: config.level,
    format: buildLoggerFormat(config.format),
    transports
  });
}
