import { Button, Checkbox, FormGroup, Page, Input, Select } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GeneralSettings, ThemeSource } from '#/shared/types';
import { formatPluginThemeValue } from '#/shared/plugin/types';

import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { usePluginThemes } from '#/renderer/src/plugins/pluginHooks';

import { DEFAULT_GENERAL_SETTINGS, THEME_OPTIONS, settingsSectionMeta } from '../constants';
import { SettingsCloseButton } from '../SettingsCloseButton';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * General settings: appearance and HTTP request defaults.
 */
export function GeneralSection({ onClose }: Props): JSX.Element {
  const [theme, setTheme] = useState<ThemeSource>('system');
  const [loading, setLoading] = useState(true);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);
  const pluginThemes = usePluginThemes();

  const themeOptions = useMemo(
    () => [
      ...THEME_OPTIONS,
      ...pluginThemes.map((entry) => ({
        value: formatPluginThemeValue(entry.pluginId, entry.id) as ThemeSource,
        label: entry.title
      }))
    ],
    [pluginThemes]
  );

  /**
   * Loads the persisted theme preference on mount.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getTheme().then((value) => {
      if (!cancelled) {
        setTheme(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Loads general request settings on mount.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getGeneralSettings().then((value) => {
      if (!cancelled) {
        setGeneralSettings(value);
        setGeneralLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates the theme preference in local form state.
   *
   * @param next - Theme source selected in the dropdown.
   */
  const handleThemeChange = (next: ThemeSource): void => {
    setTheme(next);
  };

  /**
   * Updates a general settings field in local form state.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleGeneralFieldChange = <K extends keyof GeneralSettings>(
    key: K,
    value: GeneralSettings[K]
  ): void => {
    setGeneralSettings((current) => ({ ...current, [key]: value }));
  };

  /**
   * Persists general request settings and the selected theme preference.
   */
  const handleGeneralSave = async (): Promise<void> => {
    setGeneralSaving(true);
    try {
      await applyThemePreference(theme);
      await window.api.setTheme(theme);
      await window.api.setGeneralSettings(generalSettings);
      toast.success('Settings saved.');
    } finally {
      setGeneralSaving(false);
    }
  };

  const { label, icon } = settingsSectionMeta('general');

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={label}
      icon={icon}
      description="Set appearance, request timeouts, response size limits, SSL verification, and redirect following defaults."
      actions={<SettingsCloseButton onClose={onClose} />}
    >
      <div className="mb-6 flex flex-col gap-6">
        <FormGroup label="Theme">
          <Select
            value={theme}
            disabled={loading || generalLoading || generalSaving}
            onChange={(event) => handleThemeChange(event.target.value as ThemeSource)}
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Request timeout (ms)" description="Set to 0 to disable the limit.">
          <Input
            type="number"
            min={0}
            value={generalSettings.requestTimeoutMs}
            disabled={generalLoading || generalSaving}
            onChange={(event) =>
              handleGeneralFieldChange('requestTimeoutMs', Number(event.target.value))
            }
          />
        </FormGroup>

        <FormGroup
          label="Max response size (MB)"
          description="Set to 0 for no configurable limit (512 MB hard cap still applies)."
        >
          <Input
            type="number"
            min={0}
            value={generalSettings.maxResponseSizeMb}
            disabled={generalLoading || generalSaving}
            onChange={(event) =>
              handleGeneralFieldChange('maxResponseSizeMb', Number(event.target.value))
            }
          />
        </FormGroup>

        <FormGroup label="SSL certificate verification" layout="checkbox">
          <Checkbox
            checked={generalSettings.verifySsl}
            disabled={generalLoading || generalSaving}
            onChange={(event) => handleGeneralFieldChange('verifySsl', event.target.checked)}
          />
        </FormGroup>

        <FormGroup
          label="Follow redirects"
          layout="checkbox"
          description="When disabled, 3xx responses are returned without following Location."
        >
          <Checkbox
            checked={generalSettings.followRedirects}
            disabled={generalLoading || generalSaving}
            onChange={(event) => handleGeneralFieldChange('followRedirects', event.target.checked)}
          />
        </FormGroup>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={generalLoading || generalSaving}
          onClick={() => void handleGeneralSave()}
        >
          {generalSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Page>
  );
}
