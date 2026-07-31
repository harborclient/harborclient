import type { ScriptConsoleTableData } from '../types/script';

/**
 * Formats a single console argument for script log capture.
 *
 * Strings are passed through. Objects and arrays are pretty-printed JSON.
 * Values that cannot be serialized fall back to {@link String}.
 *
 * @param value - One argument from a console method.
 * @returns Display text for this argument.
 */
export function formatConsoleArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Formats console method arguments into a single message string.
 *
 * @param args - Values passed to the capturing console method.
 * @returns Message text joined with spaces (pretty-printed objects stay multi-line).
 */
export function formatConsoleArgs(args: unknown[]): string {
  return args.map(formatConsoleArg).join(' ');
}

/**
 * Prefixes every line of a console message with group indentation.
 *
 * @param message - Formatted message text (may be multi-line).
 * @param depth - Current console.group nesting depth (non-negative).
 * @returns Message with each line prefixed by two spaces per depth level.
 */
export function indentConsoleMessage(message: string, depth: number): string {
  if (depth <= 0) {
    return message;
  }
  const prefix = '  '.repeat(depth);
  return message
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

/**
 * Cell text for a console.table cell, collapsed to a single line.
 *
 * @param value - Cell value.
 * @returns Short display string suitable for a table cell.
 */
function formatTableCell(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.replace(/\n/g, ' ');
  }
  try {
    return JSON.stringify(value)?.replace(/\n/g, ' ') ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Pads a string to a fixed width with trailing spaces.
 *
 * @param text - Cell text.
 * @param width - Target column width.
 * @returns Padded text.
 */
function padCell(text: string, width: number): string {
  if (text.length >= width) {
    return text;
  }
  return text + ' '.repeat(width - text.length);
}

/**
 * Renders {@link ScriptConsoleTableData} as an ASCII table for export / message fallback.
 *
 * @param table - Structured table payload.
 * @returns Multi-line ASCII table string.
 */
export function formatConsoleTableData(table: ScriptConsoleTableData): string {
  if (table.columns.length === 0) {
    return '(empty)';
  }
  const widths = table.columns.map((h, i) =>
    Math.max(h.length, ...table.rows.map((r) => (r[i] ?? '').length))
  );
  const formatRow = (cells: string[]): string =>
    cells.map((cell, i) => padCell(cell, widths[i] ?? 0)).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  return [formatRow(table.columns), separator, ...table.rows.map(formatRow)].join('\n');
}

/**
 * Builds structured table data from an array of row objects.
 *
 * @param rows - Objects whose keys become columns.
 * @param columns - Optional column allow-list; defaults to union of all row keys.
 * @returns Structured table, or null when there are no columns.
 */
function buildObjectRows(
  rows: Array<Record<string, unknown>>,
  columns?: string[]
): ScriptConsoleTableData | null {
  const columnSet = new Set<string>();
  if (columns && columns.length > 0) {
    for (const col of columns) {
      columnSet.add(String(col));
    }
  } else {
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        columnSet.add(key);
      }
    }
  }

  const cols = [...columnSet];
  if (cols.length === 0 && rows.length === 0) {
    return { columns: ['(index)'], rows: [] };
  }
  if (cols.length === 0) {
    return null;
  }

  return {
    columns: ['(index)', ...cols],
    rows: rows.map((row, index) => [String(index), ...cols.map((col) => formatTableCell(row[col]))])
  };
}

/**
 * Builds structured tabular data for console.table when the value is tabular.
 *
 * @param data - Value passed as the first argument to console.table.
 * @param columns - Optional column names to include.
 * @returns Structured table, or null when the value should fall back to text formatting.
 */
export function buildConsoleTable(data: unknown, columns?: unknown): ScriptConsoleTableData | null {
  const columnList =
    Array.isArray(columns) && columns.length > 0 ? columns.map((c) => String(c)) : undefined;

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { columns: ['(index)'], rows: [] };
    }
    const allObjects = data.every(
      (item) => item != null && typeof item === 'object' && !Array.isArray(item)
    );
    if (allObjects) {
      return buildObjectRows(data as Array<Record<string, unknown>>, columnList);
    }

    return {
      columns: ['(index)', 'Value'],
      rows: data.map((item, index) => [String(index), formatTableCell(item)])
    };
  }

  if (data != null && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return { columns: ['(index)'], rows: [] };
    }
    const rows: Array<Record<string, unknown>> = entries.map(([key, value]) => {
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        return { ...(value as Record<string, unknown>), __index: key };
      }
      return { Value: value, __index: key };
    });

    const columnSet = new Set<string>();
    if (columnList && columnList.length > 0) {
      for (const col of columnList) {
        columnSet.add(col);
      }
    } else {
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (key !== '__index') {
            columnSet.add(key);
          }
        }
      }
    }
    const cols = [...columnSet];
    return {
      columns: ['(index)', ...cols],
      rows: rows.map((row) => [
        String(row.__index),
        ...cols.map((col) => formatTableCell(row[col]))
      ])
    };
  }

  return null;
}

/**
 * Formats a value for console.table as an ASCII table when possible.
 *
 * Prefer {@link buildConsoleTable} when storing structured payloads; this remains
 * the string fallback for export and non-tabular values.
 *
 * @param data - Value passed as the first argument to console.table.
 * @param columns - Optional column names to include.
 * @returns Table text or a pretty-printed fallback.
 */
export function formatConsoleTable(data: unknown, columns?: unknown): string {
  const table = buildConsoleTable(data, columns);
  if (table == null) {
    return formatConsoleArg(data);
  }
  if (table.rows.length === 0) {
    return '(empty)';
  }
  return formatConsoleTableData(table);
}

/**
 * Strips absolute paths and sandbox framing from a stack string for console.trace.
 *
 * @param stack - Raw Error.stack or similar.
 * @returns Sanitized multi-line stack without the leading "Error" line when present.
 */
function sanitizeTraceStack(stack: string): string {
  const lines = stack.split('\n');
  const frames: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Error') || trimmed === 'Trace') {
      continue;
    }
    // Drop frames from this console implementation itself.
    if (trimmed.includes('formatConsoleTrace') || trimmed.includes('scriptConsole')) {
      continue;
    }
    const sanitized = trimmed
      .replace(/evalmachine\.<anonymous>/g, 'script')
      .replace(/[A-Za-z]:[\\/][^\s'"(),\]}]+/g, '[path]')
      .replace(/(^|[\s(,])(\/(?:[\w.-]+\/)+[\w.-]*)/g, '$1[path]');
    frames.push(sanitized);
  }
  return frames.join('\n');
}

/**
 * Formats a console.trace message with optional arguments and a sanitized stack.
 *
 * @param args - Values passed to console.trace (shown after "Trace:").
 * @param rawStack - Raw stack string from `new Error().stack`, or undefined.
 * @returns Multi-line trace message for log capture.
 */
export function formatConsoleTrace(args: unknown[], rawStack: string | undefined): string {
  const header = args.length > 0 ? `Trace: ${formatConsoleArgs(args)}` : 'Trace';
  if (!rawStack) {
    return header;
  }
  const stack = sanitizeTraceStack(rawStack);
  return stack ? `${header}\n${stack}` : header;
}
