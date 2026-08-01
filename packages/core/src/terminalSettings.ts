import type {
  TerminalCursorStyle,
  TerminalFontWeight,
  TerminalSettings
} from './types/settings.js';

/**
 * Default monospace stack used by the footer terminal when no override is saved.
 */
export const DEFAULT_TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/**
 * Cursor styles accepted by xterm.js `cursorStyle`.
 */
export const TERMINAL_CURSOR_STYLES: readonly TerminalCursorStyle[] = ['block', 'underline', 'bar'];

/**
 * Font weights accepted by xterm.js `fontWeight`.
 */
export const TERMINAL_FONT_WEIGHTS: readonly TerminalFontWeight[] = [
  'normal',
  'bold',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900'
];

/**
 * Factory defaults for footer terminal xterm.js options.
 */
export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  scrollback: 1000,
  cursorBlink: true,
  blinkIntervalDuration: 0,
  cursorStyle: 'block',
  fastScrollSensitivity: 5,
  fontSize: 16,
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontWeight: 'normal',
  minimumContrastRatio: 1,
  screenReaderMode: true
};

/**
 * Returns whether a value is a supported terminal cursor style.
 *
 * @param value - Raw value from storage or user input.
 */
export function isTerminalCursorStyle(value: unknown): value is TerminalCursorStyle {
  return typeof value === 'string' && (TERMINAL_CURSOR_STYLES as readonly string[]).includes(value);
}

/**
 * Returns whether a value is a supported terminal font weight.
 *
 * @param value - Raw value from storage or user input.
 */
export function isTerminalFontWeight(value: unknown): value is TerminalFontWeight {
  return typeof value === 'string' && (TERMINAL_FONT_WEIGHTS as readonly string[]).includes(value);
}

/**
 * Normalizes a non-negative finite number, falling back when invalid.
 *
 * @param value - Raw numeric value from storage or input.
 * @param fallback - Default when value is not a finite number >= 0.
 */
function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes a positive font size in pixels for the terminal.
 *
 * @param value - Raw font size from storage or input.
 * @param fallback - Default when value is not a finite number >= 1.
 */
function normalizeTerminalFontSize(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes terminal xterm.js settings with defaults for invalid fields.
 *
 * @param input - Raw terminal settings from storage or user input.
 * @returns Normalized terminal settings.
 */
export function normalizeTerminalSettings(
  input: Partial<TerminalSettings> | undefined
): TerminalSettings {
  const source = input ?? {};
  const fontFamily =
    typeof source.fontFamily === 'string' && source.fontFamily.trim().length > 0
      ? source.fontFamily.trim()
      : DEFAULT_TERMINAL_SETTINGS.fontFamily;

  return {
    scrollback: Math.floor(
      normalizeNonNegativeNumber(source.scrollback, DEFAULT_TERMINAL_SETTINGS.scrollback)
    ),
    cursorBlink: source.cursorBlink !== false,
    blinkIntervalDuration: Math.floor(
      normalizeNonNegativeNumber(
        source.blinkIntervalDuration,
        DEFAULT_TERMINAL_SETTINGS.blinkIntervalDuration
      )
    ),
    cursorStyle: isTerminalCursorStyle(source.cursorStyle)
      ? source.cursorStyle
      : DEFAULT_TERMINAL_SETTINGS.cursorStyle,
    fastScrollSensitivity: normalizeNonNegativeNumber(
      source.fastScrollSensitivity,
      DEFAULT_TERMINAL_SETTINGS.fastScrollSensitivity
    ),
    fontSize: normalizeTerminalFontSize(source.fontSize, DEFAULT_TERMINAL_SETTINGS.fontSize),
    fontFamily,
    fontWeight: isTerminalFontWeight(source.fontWeight)
      ? source.fontWeight
      : DEFAULT_TERMINAL_SETTINGS.fontWeight,
    minimumContrastRatio: normalizeNonNegativeNumber(
      source.minimumContrastRatio,
      DEFAULT_TERMINAL_SETTINGS.minimumContrastRatio
    ),
    screenReaderMode: source.screenReaderMode !== false
  };
}
