import { describe, expect, it } from 'vitest';
import { DEFAULT_TERMINAL_SETTINGS, normalizeTerminalSettings } from './terminalSettings.js';

describe('normalizeTerminalSettings', () => {
  it('returns factory defaults for undefined input', () => {
    expect(normalizeTerminalSettings(undefined)).toEqual(DEFAULT_TERMINAL_SETTINGS);
  });

  it('keeps valid overrides and falls back for invalid fields', () => {
    expect(
      normalizeTerminalSettings({
        scrollback: 2000,
        cursorBlink: false,
        blinkIntervalDuration: 500,
        cursorStyle: 'bar',
        fastScrollSensitivity: 10,
        fontSize: 18,
        fontFamily: ' Menlo, monospace ',
        fontWeight: '700',
        minimumContrastRatio: 4.5,
        screenReaderMode: false
      })
    ).toEqual({
      scrollback: 2000,
      cursorBlink: false,
      blinkIntervalDuration: 500,
      cursorStyle: 'bar',
      fastScrollSensitivity: 10,
      fontSize: 18,
      fontFamily: 'Menlo, monospace',
      fontWeight: '700',
      minimumContrastRatio: 4.5,
      screenReaderMode: false
    });

    expect(
      normalizeTerminalSettings({
        scrollback: -1,
        cursorStyle: 'invalid' as never,
        fontSize: 0,
        fontFamily: '   ',
        fontWeight: 'heavy' as never
      })
    ).toMatchObject({
      scrollback: DEFAULT_TERMINAL_SETTINGS.scrollback,
      cursorStyle: DEFAULT_TERMINAL_SETTINGS.cursorStyle,
      fontSize: DEFAULT_TERMINAL_SETTINGS.fontSize,
      fontFamily: DEFAULT_TERMINAL_SETTINGS.fontFamily,
      fontWeight: DEFAULT_TERMINAL_SETTINGS.fontWeight
    });
  });
});
