import { logVerbose } from '#/main/logger';

/** Maximum characters kept from a file preview in import verbose logs. */
const IMPORT_CONTENT_PREVIEW_CHARS = 120;

/**
 * Sanitizes import log detail values so large file bodies do not flood the terminal.
 *
 * @param value - Raw detail field from an import pipeline step.
 * @returns A log-safe representation of the value.
 */
function sanitizeImportLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= IMPORT_CONTENT_PREVIEW_CHARS) {
      return value;
    }
    return `${value.slice(0, IMPORT_CONTENT_PREVIEW_CHARS)}… (${value.length} chars)`;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeImportLogValue(entry));
  }

  if (value != null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (key === 'contents' && typeof entry === 'string') {
        sanitized.contentsBytes = entry.length;
        const firstLine = entry.split('\n')[0] ?? '';
        sanitized.contentsPreview = sanitizeImportLogValue(firstLine);
        continue;
      }
      sanitized[key] = sanitizeImportLogValue(entry);
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitizes structured import log detail before writing to verbose output.
 *
 * @param detail - Optional structured fields for one import step.
 * @returns Sanitized detail safe for terminal logging.
 */
function sanitizeImportLogDetail(
  detail?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!detail) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    sanitized[key] = sanitizeImportLogValue(value);
  }
  return sanitized;
}

/**
 * Logs one import pipeline step when verbose mode is enabled.
 *
 * @param step - Short step label such as `dialog selected` or `classified`.
 * @param detail - Optional structured fields for the step.
 */
export function logImportVerbose(step: string, detail?: Record<string, unknown>): void {
  const sanitized = sanitizeImportLogDetail(detail);
  if (sanitized) {
    logVerbose('import:', step, sanitized);
    return;
  }
  logVerbose('import:', step);
}

/**
 * Logs one import pipeline message forwarded from the renderer.
 *
 * @param args - Values forwarded from the renderer verbose logger.
 */
export function logImportVerboseFromRenderer(...args: unknown[]): void {
  if (args.length === 0) {
    logImportVerbose('renderer');
    return;
  }

  if (typeof args[0] === 'string') {
    const [step, ...rest] = args;
    const detail =
      rest.length === 1 && rest[0] != null && typeof rest[0] === 'object'
        ? (rest[0] as Record<string, unknown>)
        : rest.length > 0
          ? { args: rest }
          : undefined;
    logImportVerbose(step, detail);
    return;
  }

  logVerbose('import:', ...args.map((arg) => sanitizeImportLogValue(arg)));
}
