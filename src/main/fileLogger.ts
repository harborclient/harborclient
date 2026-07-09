import { app } from 'electron';
import { mkdirSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { inspect } from 'util';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { GeneralSettings } from '#/shared/types';

const LOG_INSPECT_DEPTH = 5;
const LOG_DATE_PATTERN = 'YYYY-MM-DD';
const LOG_MAX_SIZE = '20m';
const LOG_MAX_FILES = '14d';

let fileLogger: winston.Logger | null = null;

/**
 * Builds a daily-rotate filename pattern from a user-chosen log file path.
 *
 * @param filePath - Absolute path such as `/var/log/harborclient.log`.
 * @returns Winston filename pattern with a `%DATE%` segment before the extension.
 */
function buildRotateFilename(filePath: string): string {
  const extension = extname(filePath);
  const baseName = basename(filePath, extension);
  const dateSuffix = extension.length > 0 ? `-%DATE%${extension}` : '-%DATE%';
  return `${baseName}${dateSuffix}`;
}

/**
 * Formats log arguments the same way console would, without ANSI colors.
 *
 * @param args - Values passed to a logger helper.
 * @returns Single-line message suitable for file output.
 */
function formatLogArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      return inspect(arg, { depth: LOG_INSPECT_DEPTH, colors: false, breakLength: Infinity });
    })
    .join(' ');
}

/**
 * Returns the default log file path under Electron userData.
 *
 * @returns Absolute path to `logs/harborclient.log`.
 */
export function getDefaultLogFilePath(): string {
  return join(app.getPath('userData'), 'logs', 'harborclient.log');
}

/**
 * Writes a prefixed message to the active file logger when configured.
 *
 * @param prefix - Channel prefix such as `[verbose]` or `[request]`.
 * @param args - Values to serialize into the log line.
 */
function writeToFile(prefix: string, ...args: unknown[]): void {
  if (fileLogger == null) {
    return;
  }

  try {
    fileLogger.info(`${prefix} ${formatLogArgs(args)}`);
  } catch {
    // Logging must never crash the main process.
  }
}

/**
 * Reconfigures rotating file logging from general settings.
 *
 * Tears down any existing transport before creating a new one so path changes
 * take effect without restarting the app.
 *
 * @param settings - General settings containing {@link GeneralSettings.logFilePath}.
 */
export function configureFileLogger(settings: Pick<GeneralSettings, 'logFilePath'>): void {
  if (fileLogger != null) {
    fileLogger.close();
    fileLogger = null;
  }

  const filePath = settings.logFilePath.trim();
  if (filePath.length === 0) {
    return;
  }

  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {
    return;
  }

  const transport = new DailyRotateFile({
    dirname: dirname(filePath),
    filename: buildRotateFilename(filePath),
    datePattern: LOG_DATE_PATTERN,
    maxSize: LOG_MAX_SIZE,
    maxFiles: LOG_MAX_FILES
  });

  fileLogger = winston.createLogger({
    level: 'info',
    transports: [transport]
  });
}

/**
 * Writes a verbose-channel message to the log file when file logging is enabled.
 *
 * @param args - Values forwarded from {@link logVerbose}.
 */
export function writeVerboseLog(...args: unknown[]): void {
  writeToFile('[verbose]', ...args);
}

/**
 * Writes a request-channel message to the log file when file logging is enabled.
 *
 * @param args - Values forwarded from {@link logRequest}.
 */
export function writeRequestLog(...args: unknown[]): void {
  writeToFile('[request]', ...args);
}
