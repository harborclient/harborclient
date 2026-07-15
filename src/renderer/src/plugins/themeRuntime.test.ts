import { describe, expect, it } from 'vitest';
import { buildBuiltinThemeCss, buildCustomThemeCss, resolveBuiltinThemeId } from './themeRuntime';

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

  it('maps script stage tokens to --mac-script-stage-* variables', () => {
    const css = buildCustomThemeCss(
      {
        'script-stage-main': '#32d2e2',
        'script-stage-before-all': '#1360ae'
      },
      'dark'
    );

    expect(css).toContain('--mac-script-stage-main: #32d2e2;');
    expect(css).toContain('--mac-script-stage-before-all: #1360ae;');
  });

  it('uses light color-scheme for light custom themes', () => {
    const css = buildCustomThemeCss({ surface: '#ffffff' }, 'light');
    expect(css).toContain('color-scheme: light;');
  });
});

describe('buildBuiltinThemeCss', () => {
  it('maps built-in theme tokens under the semantic data-theme selector', () => {
    const css = buildBuiltinThemeCss(
      {
        surface: '#1e1e1e',
        accent: '#0a84ff'
      },
      'dark',
      'dark'
    );

    expect(css).toContain(":root[data-theme='dark']");
    expect(css).toContain('color-scheme: dark;');
    expect(css).toContain('--mac-surface: #1e1e1e;');
    expect(css).toContain('--mac-accent: #0a84ff;');
  });
});

describe('resolveBuiltinThemeId', () => {
  it('returns explicit built-in ids unchanged', () => {
    expect(resolveBuiltinThemeId('light')).toBe('light');
    expect(resolveBuiltinThemeId('dark')).toBe('dark');
    expect(resolveBuiltinThemeId('high-contrast')).toBe('high-contrast');
  });
});
