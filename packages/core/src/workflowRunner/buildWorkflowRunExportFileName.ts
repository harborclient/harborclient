/**
 * Pads a non-negative integer to two digits for filename timestamps.
 *
 * @param value - Hour, minute, second, month, or day component.
 * @returns Zero-padded two-character string.
 */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Builds the auto-export basename for a completed workflow run.
 *
 * Format: `workflow-yyyy-mm-dd-hh-mm-ss.json` using local time.
 *
 * @param date - Instant used for the timestamp (defaults to now).
 * @returns Basename suitable for writing under an export directory.
 */
export function buildWorkflowRunExportFileName(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `workflow-${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}.json`;
}
