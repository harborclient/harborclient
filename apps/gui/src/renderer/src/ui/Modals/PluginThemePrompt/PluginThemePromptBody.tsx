import { ThemeVariantPickerModal } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginThemePromptState } from '#/renderer/src/store/slices/modalsSlice';

interface Props {
  /**
   * Active plugin theme prompt payload.
   */
  prompt: PluginThemePromptState;

  /**
   * Whether a theme switch request is in flight.
   */
  switching: boolean;

  /**
   * Dismisses the prompt without changing the active theme.
   */
  onClose: () => void;

  /**
   * Applies the selected plugin theme and persists the preference.
   */
  onSwitch: (themeId: string) => Promise<void>;
}

/**
 * Renders the theme prompt body and keeps radio selection scoped to one prompt open.
 */
export function PluginThemePromptBody({
  prompt,
  switching,
  onClose,
  onSwitch
}: Props): JSX.Element {
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
