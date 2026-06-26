import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AiSettings } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { Input } from '#/renderer/src/components/forms';
import { DEFAULT_AI_SETTINGS, settingsSectionMeta } from '../constants';

/**
 * AI settings: API keys for OpenAI, Claude, and Google Gemini.
 */
export function AiSection(): JSX.Element {
  const [aiSettings, setAiSettingsState] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads AI settings on mount so API key fields are populated from storage.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      try {
        const value = await window.api.getAiSettings();
        if (!cancelled) {
          setAiSettingsState(value);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Updates an AI settings field in local form state.
   *
   * @param key - AI settings field to update.
   * @param value - New field value.
   */
  const handleFieldChange = <K extends keyof AiSettings>(key: K, value: AiSettings[K]): void => {
    setError(null);
    setAiSettingsState((current) => ({ ...current, [key]: value }));
  };

  /**
   * Persists AI provider API keys.
   */
  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await window.api.setAiSettings(aiSettings);
      toast.success('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const fieldsDisabled = loading || saving;

  const { label, icon } = settingsSectionMeta('ai');

  return (
    <div className="mb-6 flex flex-col gap-2">
      <PageHeader
        title={label}
        icon={icon}
        description="Store API keys for OpenAI, Claude, and Google Gemini used by the AI sidebar."
      />
      <div className="mb-6 flex flex-col gap-6">
        <label className="flex flex-col gap-1" htmlFor="ai-openai-api-key">
          <span className="text-[14px] font-medium text-text">OpenAI API key</span>
          <Input
            id="ai-openai-api-key"
            type="password"
            value={aiSettings.openaiApiKey}
            disabled={fieldsDisabled}
            autoComplete="off"
            onChange={(event) => handleFieldChange('openaiApiKey', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1" htmlFor="ai-claude-api-key">
          <span className="text-[14px] font-medium text-text">Claude API key</span>
          <Input
            id="ai-claude-api-key"
            type="password"
            value={aiSettings.claudeApiKey}
            disabled={fieldsDisabled}
            autoComplete="off"
            onChange={(event) => handleFieldChange('claudeApiKey', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1" htmlFor="ai-gemini-api-key">
          <span className="text-[14px] font-medium text-text">Google Gemini API key</span>
          <Input
            id="ai-gemini-api-key"
            type="password"
            value={aiSettings.geminiApiKey}
            disabled={fieldsDisabled}
            autoComplete="off"
            onChange={(event) => handleFieldChange('geminiApiKey', event.target.value)}
          />
        </label>

        <p className="m-0 text-[14px] text-muted">
          Personal API keys are encrypted and stored locally on this machine. HarborClient uses the
          OS keychain when available, or a local encryption key otherwise. When a connected Team Hub
          offers the same model, HarborClient prefers the hub and uses these keys only as a
          fallback.
        </p>
      </div>

      {error && (
        <p className="mb-0 text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" disabled={fieldsDisabled} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
