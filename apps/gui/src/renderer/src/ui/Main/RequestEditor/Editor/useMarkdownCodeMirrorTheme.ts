import type { Extension } from '@codemirror/state';
import type { Variable } from '#/shared/types';
import { useEffect, useMemo, useState } from 'react';
import { isAppearanceDark } from '#/renderer/src/appearanceTheme';
import { subscribeThemeColorsApplied } from '#/renderer/src/plugins/themeRuntime';
import { createVariableCodeMirrorExtensions } from './variableHighlightPlugin';
import { createMarkdownCodeMirrorThemeExtensions } from './markdownCodeMirrorTheme';

/**
 * Builds CodeMirror extensions for MDXEditor fenced blocks, including
 * appearance-aware theme overrides and variable highlighting.
 *
 * Recomputes when the app theme or collection variables change so code blocks
 * stay readable after the user switches light/dark appearance.
 *
 * @param variables - Collection-scoped variables for highlighting and tooltips.
 * @param onEditVariables - Opens collection settings to edit variables.
 * @returns CodeMirror extensions for `codeMirrorPlugin`.
 */
export function useMarkdownCodeMirrorTheme(
  variables: Variable[],
  onEditVariables?: (key: string) => void
): Extension[] {
  const [isDark, setIsDark] = useState(() => isAppearanceDark());

  /**
   * Syncs dark-mode state when HarborClient applies theme colors or the OS
   * color scheme changes under System appearance.
   */
  useEffect(() => {
    /**
     * Re-reads resolved appearance from the document root.
     */
    const syncAppearance = (): void => {
      setIsDark(isAppearanceDark());
    };

    syncAppearance();

    const unsubscribeTheme = subscribeThemeColorsApplied(syncAppearance);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', syncAppearance);

    return () => {
      unsubscribeTheme();
      media.removeEventListener('change', syncAppearance);
    };
  }, []);

  /**
   * Memoizes theme and variable extensions so MDXEditor only reconfigures when
   * appearance mode or variable data actually changes.
   */
  return useMemo(
    () => [
      ...createMarkdownCodeMirrorThemeExtensions(isDark),
      ...createVariableCodeMirrorExtensions(variables, onEditVariables)
    ],
    [isDark, variables, onEditVariables]
  );
}
