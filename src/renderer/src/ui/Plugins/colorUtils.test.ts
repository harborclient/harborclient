import { describe, expect, it } from 'vitest';
import { formatCssColor, parseCssColor } from '#/renderer/src/ui/Plugins/colorUtils';

describe('colorUtils', () => {
  it('parses and formats hex colors', () => {
    expect(parseCssColor('#ff00aa')).toEqual({ r: 255, g: 0, b: 170, a: 1 });
    expect(formatCssColor({ r: 255, g: 0, b: 170, a: 1 })).toBe('#ff00aa');
  });

  it('parses and formats rgba colors', () => {
    expect(parseCssColor('rgba(10, 132, 255, 0.22)')).toEqual({
      r: 10,
      g: 132,
      b: 255,
      a: 0.22
    });
    expect(formatCssColor({ r: 10, g: 132, b: 255, a: 0.22 })).toBe('rgba(10, 132, 255, 0.22)');
  });
});
