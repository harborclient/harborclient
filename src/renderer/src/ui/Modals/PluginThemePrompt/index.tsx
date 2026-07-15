import { useCallback, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ThemeSource } from '#/shared/types';
import { formatPluginThemeValue } from '#/shared/plugin/types';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closePluginThemePrompt,
  selectPluginThemePrompt
} from '#/renderer/src/store/slices/modalsSlice';
import { PluginThemePromptBody } from '#/renderer/src/ui/Modals/PluginThemePrompt/PluginThemePromptBody';

/**
 * Prompts the user to switch to a theme contributed by a plugin they just enabled.
 */
export function PluginThemePrompt(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const prompt = useAppSelector(selectPluginThemePrompt);
  const [switching, setSwitching] = useState(false);

  /**
   * Dismisses the prompt without changing the active theme.
   */
  const handleClose = useCallback((): void => {
    if (switching) {
      return;
    }
    dispatch(closePluginThemePrompt());
  }, [dispatch, switching]);

  /**
   * Applies the selected plugin theme and persists the preference.
   *
   * @param themeId - Contributed theme id within the active plugin.
   */
  const handleSwitch = useCallback(
    async (themeId: string): Promise<void> => {
      if (!prompt) {
        return;
      }
      setSwitching(true);
      try {
        const value = formatPluginThemeValue(prompt.pluginId, themeId);
        await applyThemePreference(value);
        await window.api.setTheme(value as ThemeSource);
        toast.success('Theme updated.');
        dispatch(closePluginThemePrompt());
      } finally {
        setSwitching(false);
      }
    },
    [dispatch, prompt]
  );

  if (!prompt) {
    return null;
  }

  return (
    <PluginThemePromptBody
      key={prompt.pluginId}
      prompt={prompt}
      switching={switching}
      onClose={handleClose}
      onSwitch={handleSwitch}
    />
  );
}
