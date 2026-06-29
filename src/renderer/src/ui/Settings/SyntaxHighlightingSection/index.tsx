import {
  Button,
  FormGroup,
  Page,
  Input,
  Select,
  CodeEditor,
  CODE_EDITOR_THEME_OPTIONS
} from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';

import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setGeneralSettingsState } from '#/renderer/src/store/slices/settingsSlice';
import type { CodeEditorSetup, GeneralSettings } from '#/shared/types';

import { DEFAULT_GENERAL_SETTINGS, settingsSectionMeta } from '../constants';
import { PREVIEW_SAMPLE, SETUP_OPTIONS } from './constants';
import { SettingsCloseButton } from '../SettingsCloseButton';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * Syntax highlighting settings: CodeMirror theme, editor setup toggles, and live preview.
 */
export function SyntaxHighlightingSection({ onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * Loads general settings on mount so code editor fields are populated from storage.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getGeneralSettings().then((value) => {
      if (!cancelled) {
        setGeneralSettings(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates the selected CodeMirror theme in local form state.
   *
   * @param codeEditorTheme - Theme identifier from the dropdown.
   */
  const handleThemeChange = (codeEditorTheme: GeneralSettings['codeEditorTheme']): void => {
    setGeneralSettings((current) => ({ ...current, codeEditorTheme }));
  };

  /**
   * Updates a single CodeMirror setup flag in local form state.
   *
   * @param key - Setup field to update.
   * @param value - New checkbox value.
   */
  const handleSetupChange = (key: keyof CodeEditorSetup, value: boolean): void => {
    setGeneralSettings((current) => ({
      ...current,
      codeEditorSetup: { ...current.codeEditorSetup, [key]: value }
    }));
  };

  /**
   * Persists syntax highlighting settings and updates the renderer store.
   */
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await window.api.setGeneralSettings(generalSettings);
      dispatch(setGeneralSettingsState(generalSettings));
      toast.success('Settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const { label, icon } = settingsSectionMeta('syntax');

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={label}
      icon={icon}
      description="Choose a CodeMirror theme and editor behavior for request and response editors."
      actions={<SettingsCloseButton onClose={onClose} />}
    >
      <div className="flex flex-col gap-6">
        <FormGroup label="Theme">
          <Select
            value={generalSettings.codeEditorTheme}
            disabled={loading || saving}
            onChange={(event) =>
              handleThemeChange(event.target.value as GeneralSettings['codeEditorTheme'])
            }
          >
            {CODE_EDITOR_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        {SETUP_OPTIONS.map((option) => (
          <FormGroup key={option.key} label={option.label} layout="checkbox">
            <Input
              type="checkbox"
              checked={generalSettings.codeEditorSetup[option.key]}
              disabled={loading || saving}
              onChange={(event) => handleSetupChange(option.key, event.target.checked)}
            />
          </FormGroup>
        ))}

        <div className="flex items-center gap-3">
          <Button type="button" disabled={loading || saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-6">
        <span className="text-[14px] font-medium text-text">Preview</span>
        <CodeEditor
          value={PREVIEW_SAMPLE}
          readOnly
          language="javascript"
          minHeight="120px"
          themeOverride={generalSettings.codeEditorTheme}
          setupOverride={generalSettings.codeEditorSetup}
        />
      </div>
    </Page>
  );
}
