import { useEffect, useState } from 'react';
import { hasAvailableAiModels } from '#/shared/aiModels';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Settings/constants';

/**
 * Loads AI provider settings and Team Hub models, then reports whether chat is available.
 *
 * @returns AI availability flag, loaded settings for chat initialization, and loading state.
 */
export function useAiAvailability(): {
  aiAvailable: boolean;
  aiSettings: AiSettings;
  hubModelGroups: HubLlmModelGroup[];
  loading: boolean;
} {
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [hubModelGroups, setHubModelGroups] = useState<HubLlmModelGroup[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches personal API keys and hub LLM models on mount.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      try {
        const [value, hubs] = await Promise.all([
          window.api.getAiSettings(),
          window.api.listHubLlmModels()
        ]);
        if (!cancelled) {
          setAiSettings(value);
          setHubModelGroups(hubs);
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

  return {
    aiAvailable: !loading && hasAvailableAiModels(aiSettings, hubModelGroups),
    aiSettings,
    hubModelGroups,
    loading
  };
}
