import { ThemeVariantPickerModal } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ThemeSource } from '#/shared/types';
import { formatPluginThemeValue } from '#/shared/plugin/types';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closePluginThemePrompt,
  selectPluginThemePrompt,
  type PluginThemePromptState
} from '#/renderer/src/store/slices/modalsSlice';

interface PromptBodyProps {
  /** Active plugin theme prompt payload. */
  prompt: PluginThemePromptState;
  /** Whether a theme switch request is in flight. */
  switching: boolean;
  /** Dismisses the prompt without changing the active theme. */
  onClose: () => void;
  /** Applies the selected plugin theme and persists the preference. */
  onSwitch: (themeId: string) => Promise<void>;
}

/**
 * Renders the theme prompt body and keeps radio selection scoped to one prompt open.
 */
function PluginThemePromptBody({
  prompt,
  switching,
  onClose,
  onSwitch
}: PromptBodyProps): JSX.Element {
  const singleTheme = prompt.themes.length === 1 ? prompt.themes[0] : null;
  const title = singleTheme ? 'Switch theme?' : 'Choose a theme';
  const description = singleTheme
    ? `${prompt.pluginName} added the ${singleTheme.title} theme. Switch to it now?`
    : `${prompt.pluginName} added ${prompt.themes.length} themes. Which one would you like to use?`;

  return (
    <ThemeVariantPickerModal
      variants={prompt.themes.map((theme) => ({
        id: theme.id,
        label: theme.title
      }))}
      selectionMode="radio"
      title={title}
      description={description}
      showSelector={prompt.themes.length > 1}
      selectorLabel="Plugin themes"
      busy={switching}
      confirmLabel="Switch"
      busyConfirmLabel="Switching…"
      cancelLabel="Not now"
      onConfirm={onSwitch}
      onCancel={onClose}
    />
  );
}

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
