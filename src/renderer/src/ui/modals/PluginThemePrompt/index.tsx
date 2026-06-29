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
import { Button, FormGroup, Modal, ModalFooter, Radio } from '@harborclient/sdk/components';

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
  const [selectedThemeId, setSelectedThemeId] = useState(prompt.themes[0]?.id ?? '');

  const singleTheme = prompt.themes.length === 1 ? prompt.themes[0] : null;
  const title = singleTheme ? 'Switch theme?' : 'Choose a theme';
  const radioGroupName = `plugin-theme-prompt-${prompt.pluginId}`;

  /**
   * Applies the currently selected theme and closes the prompt on success.
   */
  const handleSwitch = useCallback(async (): Promise<void> => {
    if (!selectedThemeId) {
      return;
    }
    await onSwitch(selectedThemeId);
  }, [onSwitch, selectedThemeId]);

  return (
    <Modal
      onClose={onClose}
      labelledBy="plugin-theme-prompt-title"
      title={title}
      closeDisabled={switching}
      disableEscape={switching}
    >
      {singleTheme ? (
        <p className="mb-4 text-[14px] text-muted">
          {prompt.pluginName} added the {singleTheme.title} theme. Switch to it now?
        </p>
      ) : (
        <>
          <p className="mb-4 text-[14px] text-muted">
            {prompt.pluginName} added {prompt.themes.length} themes. Which one would you like to
            use?
          </p>
          <fieldset className="m-0 space-y-2 border-none p-0">
            <legend className="sr-only">Plugin themes</legend>
            {prompt.themes.map((theme) => (
              <FormGroup key={theme.id} label={theme.title} layout="checkbox">
                <Radio
                  name={radioGroupName}
                  checked={selectedThemeId === theme.id}
                  onChange={() => setSelectedThemeId(theme.id)}
                  disabled={switching}
                />
              </FormGroup>
            ))}
          </fieldset>
        </>
      )}
      <ModalFooter>
        <Button type="button" variant="secondary" disabled={switching} onClick={onClose}>
          Not now
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={switching || !selectedThemeId}
          onClick={() => void handleSwitch()}
        >
          {switching ? 'Switching…' : 'Switch'}
        </Button>
      </ModalFooter>
    </Modal>
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
