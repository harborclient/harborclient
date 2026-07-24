/**
 * Delay before opening the tooltip after the pointer settles on the preview.
 */
export const CODE_PREVIEW_TOOLTIP_SETTLE_MS = 400;

/**
 * Maximum number of source lines shown in the hover tooltip.
 */
export const CODE_PREVIEW_TOOLTIP_MAX_LINES = 5;

/**
 * Returns the first source line for a code preview.
 *
 * @param code - JavaScript source to inspect.
 * @returns First line of source, or null when there is no code.
 */
export function codeFirstLinePreview(code: string): string | null {
  if (!code.trim()) {
    return null;
  }

  return (code.split('\n')[0] ?? '').trimEnd();
}

/**
 * Returns up to five source lines for the preview tooltip.
 *
 * @param code - JavaScript source to inspect.
 * @param maxLines - Maximum number of lines to include.
 * @returns Joined source lines, or null when there is no code.
 */
export function codeTooltipLines(
  code: string,
  maxLines = CODE_PREVIEW_TOOLTIP_MAX_LINES
): string | null {
  if (!code.trim()) {
    return null;
  }

  return code.split('\n').slice(0, maxLines).join('\n');
}

/**
 * Builds preview and tooltip content for one code sample.
 *
 * @param code - JavaScript source to inspect.
 * @returns Preview text for the row and tooltip, or null when there is no code.
 */
export function buildCodePreview(code: string): { firstLine: string; tooltipLines: string } | null {
  const firstLine = codeFirstLinePreview(code);
  const tooltipLines = codeTooltipLines(code);

  if (!firstLine || !tooltipLines) {
    return null;
  }

  return { firstLine, tooltipLines };
}
