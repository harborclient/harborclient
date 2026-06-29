import { Button, FormGroup, Page, Input, Select } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GeneralSettings, ProxySettings } from '#/shared/types';

import {
  DEFAULT_GENERAL_SETTINGS,
  PROXY_PROTOCOL_OPTIONS,
  settingsSectionMeta
} from '../constants';
import { SettingsCloseButton } from '../SettingsCloseButton';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * Proxy settings: global HTTP proxy configuration for outbound requests.
 */
export function ProxySection({ onClose }: Props): JSX.Element {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * Loads general settings on mount so proxy fields are populated from storage.
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
   * Updates a proxy settings field in local form state.
   *
   * @param key - Proxy field to update.
   * @param value - New field value.
   */
  const handleProxyFieldChange = <K extends keyof ProxySettings>(
    key: K,
    value: ProxySettings[K]
  ): void => {
    setGeneralSettings((current) => ({
      ...current,
      proxy: { ...current.proxy, [key]: value }
    }));
  };

  /**
   * Persists general settings including proxy configuration.
   */
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await window.api.setGeneralSettings(generalSettings);
      toast.success('Settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const { proxy } = generalSettings;
  const fieldsDisabled = loading || saving;
  const proxyFieldsDisabled = fieldsDisabled || !proxy.enabled;
  const authFieldsDisabled = proxyFieldsDisabled || !proxy.authEnabled;

  const { label, icon } = settingsSectionMeta('proxy');

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={label}
      icon={icon}
      description="Route HarborClient's outbound HTTP requests through a proxy server."
      actions={<SettingsCloseButton onClose={onClose} />}
    >
      <div className="mb-6 flex flex-col gap-6">
        <FormGroup label="Use a proxy" layout="checkbox">
          <Input
            type="checkbox"
            checked={proxy.enabled}
            disabled={fieldsDisabled}
            onChange={(event) => handleProxyFieldChange('enabled', event.target.checked)}
          />
        </FormGroup>

        <FormGroup label="Protocol">
          <Select
            value={proxy.protocol}
            disabled={proxyFieldsDisabled}
            onChange={(event) =>
              handleProxyFieldChange('protocol', event.target.value as ProxySettings['protocol'])
            }
          >
            {PROXY_PROTOCOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Host">
          <Input
            type="text"
            value={proxy.host}
            disabled={proxyFieldsDisabled}
            placeholder="proxy.example.com"
            onChange={(event) => handleProxyFieldChange('host', event.target.value)}
          />
        </FormGroup>

        <FormGroup label="Port">
          <Input
            type="number"
            min={1}
            max={65535}
            value={proxy.port}
            disabled={proxyFieldsDisabled}
            onChange={(event) => handleProxyFieldChange('port', Number(event.target.value))}
          />
        </FormGroup>

        <FormGroup label="Use basic authentication" layout="checkbox">
          <Input
            type="checkbox"
            checked={proxy.authEnabled}
            disabled={proxyFieldsDisabled}
            onChange={(event) => handleProxyFieldChange('authEnabled', event.target.checked)}
          />
        </FormGroup>

        {proxy.authEnabled && (
          <>
            <FormGroup label="Username">
              <Input
                type="text"
                value={proxy.username}
                disabled={authFieldsDisabled}
                autoComplete="off"
                onChange={(event) => handleProxyFieldChange('username', event.target.value)}
              />
            </FormGroup>

            <FormGroup label="Password">
              <Input
                type="password"
                value={proxy.password}
                disabled={authFieldsDisabled}
                autoComplete="off"
                onChange={(event) => handleProxyFieldChange('password', event.target.value)}
              />
            </FormGroup>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={fieldsDisabled} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Page>
  );
}
