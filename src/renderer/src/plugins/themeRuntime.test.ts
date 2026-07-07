import { describe, expect, it } from 'vitest';
import { buildCustomThemeCss } from '#/renderer/src/plugins/themeRuntime';

describe('buildCustomThemeCss', () => {
  it('maps custom theme tokens to --mac-* variables under data-theme=custom', () => {
    const css = buildCustomThemeCss(
      {
        surface: '#111111',
        accent: 'rgba(10, 132, 255, 0.5)'
      },
      'dark'
    );

    expect(css).toContain(":root[data-theme='custom']");
    expect(css).toContain('color-scheme: dark;');
    expect(css).toContain('--mac-surface: #111111;');
    expect(css).toContain('--mac-accent: rgba(10, 132, 255, 0.5);');
  });

  it('uses light color-scheme for light custom themes', () => {
    const css = buildCustomThemeCss({ surface: '#ffffff' }, 'light');
    expect(css).toContain('color-scheme: light;');
  });
});
