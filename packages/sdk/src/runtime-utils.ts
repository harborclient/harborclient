/**
 * Creates a new unique id string.
 *
 * Uses `crypto.randomUUID` when available (renderer); falls back for the SES main runtime.
 *
 * @param prefix - Optional prefix when falling back from randomUUID.
 */
export function randomId(prefix = 'id'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Returns the UTF-8 byte length of a string without relying on TextEncoder.
 *
 * Safe in the SES plugin main runtime where only `hc`, `console`, `Date`, and `Math`
 * globals are available.
 *
 * @param value - String to measure.
 */
export function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Truncates a string to a maximum UTF-8 byte length without TextEncoder.
 *
 * @param value - String to truncate.
 * @param maxBytes - Maximum UTF-8 bytes to retain.
 */
export function truncateToBytes(value: string, maxBytes: number): string {
  if (typeof TextEncoder !== 'undefined') {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length <= maxBytes) {
      return value;
    }
    return new TextDecoder().decode(encoded.slice(0, maxBytes));
  }
  let bytes = 0;
  let index = 0;
  for (; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    let charBytes: number;
    if (code <= 0x7f) {
      charBytes = 1;
    } else if (code <= 0x7ff) {
      charBytes = 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      charBytes = 4;
    } else {
      charBytes = 3;
    }
    if (bytes + charBytes > maxBytes) {
      break;
    }
    bytes += charBytes;
    if (charBytes === 4) {
      index += 1;
    }
  }
  return value.slice(0, index);
}

/**
 * Truncates a body string to the configured byte limit with an optional suffix.
 *
 * @param body - Raw body text.
 * @param maxBytes - Maximum UTF-8 bytes to retain.
 * @param suffix - Optional suffix appended when truncated.
 */
export function truncateBody(
  body: string,
  maxBytes: number,
  suffix = `\n\n[truncated — body exceeded ${maxBytes} bytes]`
): { body: string; truncated: boolean } {
  if (byteLength(body) <= maxBytes) {
    return { body, truncated: false };
  }
  return {
    body: `${truncateToBytes(body, maxBytes)}${suffix}`,
    truncated: true
  };
}

/**
 * Minimum log level emitted by {@link createLogger}.
 *
 * Messages below the active level are suppressed. `silent` suppresses all output.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Plugin-scoped logger with consistent `[pluginId]` prefixing and level control.
 *
 * Safe in the SES plugin main runtime where only `console`, `Date`, and `Math`
 * globals are available.
 */
export interface Logger {
  /**
   * Logs a debug message when the active level is `debug`.
   *
   * @param args - Values forwarded to the console after the prefix.
   */
  debug(...args: unknown[]): void;

  /**
   * Logs an informational message when the active level is `debug` or `info`.
   *
   * @param args - Values forwarded to the console after the prefix.
   */
  info(...args: unknown[]): void;

  /**
   * Logs a warning when the active level is below `error`.
   *
   * @param args - Values forwarded to the console after the prefix.
   */
  warn(...args: unknown[]): void;

  /**
   * Logs an error when the active level is not `silent`.
   *
   * @param args - Values forwarded to the console after the prefix.
   */
  error(...args: unknown[]): void;

  /**
   * Changes the minimum log level for subsequent calls.
   *
   * @param level - New minimum level.
   */
  setLevel(level: LogLevel): void;
}

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

/**
 * Creates a plugin-scoped logger that prefixes every message with `[pluginId]`.
 *
 * Routes through `console` only so the logger works in both the renderer and
 * the SES-hardened main runtime. When `console.warn` or `console.error` are
 * unavailable, falls back to `console.log`.
 *
 * @param pluginId - Manifest id used as the log prefix.
 * @param options - Optional initial configuration.
 * @param options.level - Minimum level to emit. Defaults to `info`.
 * @returns Logger with level-filtered `debug`, `info`, `warn`, and `error` methods.
 */
/**
 * Builds a structured plugin server HTTP response for `hc.server.onRequest`.
 *
 * @param partial - Status, headers, body, and/or delay (without `kind`).
 * @returns A response the host can apply with custom status, headers, body, and delay.
 */
export function createHttpResponse(
  partial: {
    status?: number;
    headers?: Record<string, string>;
    body?: unknown;
    delayMs?: number;
  } = {}
): {
  kind: 'http-response';
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delayMs?: number;
} {
  return {
    kind: 'http-response',
    ...partial
  };
}

/**
 * Creates a plugin-scoped logger that prefixes every message with `[pluginId]`.
 *
 * Routes through `console` only so the logger works in both the renderer and
 * the SES-hardened main runtime. When `console.warn` or `console.error` are
 * unavailable, falls back to `console.log`.
 *
 * @param pluginId - Manifest id used as the log prefix.
 * @param options - Optional initial configuration.
 * @param options.level - Minimum level to emit. Defaults to `info`.
 * @returns Logger with level-filtered `debug`, `info`, `warn`, and `error` methods.
 */
export function createLogger(pluginId: string, options?: { level?: LogLevel }): Logger {
  const prefix = `[${pluginId}]`;
  let level: LogLevel = options?.level ?? 'info';

  /**
   * Emits a message when its severity meets the active level threshold.
   *
   * @param messageLevel - Severity of the message being logged.
   * @param write - Console method to invoke when the message is not suppressed.
   * @param args - Values forwarded after the prefix.
   */
  function log(
    messageLevel: LogLevel,
    write: (...values: unknown[]) => void,
    ...args: unknown[]
  ): void {
    if (LOG_LEVEL_RANK[messageLevel] < LOG_LEVEL_RANK[level]) {
      return;
    }
    write(prefix, ...args);
  }

  const consoleLog = (...values: unknown[]): void => {
    console.log(...values);
  };

  return {
    debug(...args: unknown[]): void {
      log('debug', consoleLog, ...args);
    },
    info(...args: unknown[]): void {
      log('info', consoleLog, ...args);
    },
    warn(...args: unknown[]): void {
      const write =
        typeof console.warn === 'function'
          ? (...values: unknown[]): void => {
              console.warn(...values);
            }
          : consoleLog;
      log('warn', write, ...args);
    },
    error(...args: unknown[]): void {
      const write =
        typeof console.error === 'function'
          ? (...values: unknown[]): void => {
              console.error(...values);
            }
          : consoleLog;
      log('error', write, ...args);
    },
    setLevel(nextLevel: LogLevel): void {
      level = nextLevel;
    }
  };
}
