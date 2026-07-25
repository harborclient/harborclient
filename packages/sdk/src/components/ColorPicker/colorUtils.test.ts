import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_SWATCH_SLOT_COUNT,
  DEFAULT_COLOR_PICKER_PRESETS,
  colorsMatch,
  normalizeCssColor,
  toHexColorInputValue
} from './colorUtils.js';
import {
  DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY,
  loadCustomSwatches,
  padCustomSwatchSlots,
  persistCustomSwatches
} from './customSwatches.js';

describe('colorUtils', () => {
  it('normalizes hex colors to lowercase', () => {
    expect(normalizeCssColor('#AABBCC')).toBe('#aabbcc');
  });

  it('matches equivalent colors case-insensitively', () => {
    expect(colorsMatch('#FF0000', '#ff0000')).toBe(true);
    expect(colorsMatch('#FF0000', '#00FF00')).toBe(false);
    expect(colorsMatch(null, '#ff0000')).toBe(false);
  });

  it('expands three-digit hex for native color inputs', () => {
    expect(toHexColorInputValue('#abc')).toBe('#aabbcc');
    expect(toHexColorInputValue('#aabbcc')).toBe('#aabbcc');
    expect(toHexColorInputValue(null)).toBe('#808080');
  });

  it('exposes ten default presets and five custom slots', () => {
    expect(DEFAULT_COLOR_PICKER_PRESETS).toHaveLength(10);
    expect(CUSTOM_SWATCH_SLOT_COUNT).toBe(5);
  });
});

describe('customSwatches', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        }
      },
      configurable: true
    });
  });

  it('round-trips custom swatches through localStorage', () => {
    persistCustomSwatches(DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY, ['#112233', '#445566']);
    expect(loadCustomSwatches(DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY)).toEqual(['#112233', '#445566']);
  });

  it('pads custom slots to the fixed count', () => {
    expect(padCustomSwatchSlots(['#111111'])).toEqual(['#111111', '', '', '', '']);
  });
});
