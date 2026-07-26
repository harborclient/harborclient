// @vitest-environment jsdom
import { tags } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { lightHighlight } from './editorChrome.js';
import { renderHighlightedPlaceholderDom } from './renderHighlightedPlaceholder.js';
import { getCodeEditorThemeExtension, resolvePlaceholderSyntaxHighlighting } from './themes.js';

const PLACEHOLDER_TEXT = "hc.request.url = 'https://example.com';";

/**
 * Returns whether rendered placeholder DOM contains a token styled by the
 * built-in light highlight style.
 *
 * @param dom - Placeholder element returned by the renderer.
 */
function usesBuiltInLightTokens(dom: HTMLElement): boolean {
  const stringClass = lightHighlight.style([tags.string]);
  if (stringClass == null) {
    throw new Error('lightHighlight does not style string tokens');
  }
  return dom.querySelector(`.${stringClass}`) != null;
}

describe('resolvePlaceholderSyntaxHighlighting', () => {
  it('keeps the selected theme in dark appearance', () => {
    expect(resolvePlaceholderSyntaxHighlighting('monokai', true)).toBe(
      getCodeEditorThemeExtension('monokai')
    );
  });

  it('keeps light-native themes in light appearance', () => {
    expect(resolvePlaceholderSyntaxHighlighting('githubLight', false)).toBe(
      getCodeEditorThemeExtension('githubLight')
    );
    expect(resolvePlaceholderSyntaxHighlighting('solarizedLight', false)).toBe(
      getCodeEditorThemeExtension('solarizedLight')
    );
  });

  it('replaces dark-background themes with built-in light highlighting in light appearance', () => {
    expect(resolvePlaceholderSyntaxHighlighting('monokai', false)).not.toBe(
      getCodeEditorThemeExtension('monokai')
    );
  });
});

describe('renderHighlightedPlaceholderDom', () => {
  it('renders built-in light token colors for a dark theme in light appearance', () => {
    const dom = renderHighlightedPlaceholderDom(PLACEHOLDER_TEXT, {
      fontSize: '16px',
      isDark: false,
      theme: 'monokai'
    });

    expect(usesBuiltInLightTokens(dom)).toBe(true);
  });

  it('keeps the selected dark theme rendering in dark appearance', () => {
    const dom = renderHighlightedPlaceholderDom(PLACEHOLDER_TEXT, {
      fontSize: '16px',
      isDark: true,
      theme: 'monokai'
    });

    expect(usesBuiltInLightTokens(dom)).toBe(false);
  });

  it('fades the placeholder less in light appearance than in dark', () => {
    const light = renderHighlightedPlaceholderDom(PLACEHOLDER_TEXT, {
      fontSize: '16px',
      isDark: false,
      theme: 'monokai'
    });
    const dark = renderHighlightedPlaceholderDom(PLACEHOLDER_TEXT, {
      fontSize: '16px',
      isDark: true,
      theme: 'monokai'
    });

    expect(Number(light.style.opacity)).toBeGreaterThan(Number(dark.style.opacity));
  });
});
