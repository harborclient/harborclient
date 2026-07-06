import { useEffect, useState } from 'react';
import { hasAvailableAiModels } from '#/shared/ai/models';
import type { AiSettings } from '#/shared/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectHubModelGroups } from '#/renderer/src/store/slices/aiChatSlice';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Settings/constants';

/**
 * Loads AI provider settings and Team Hub models, then reports whether chat is available.
 *
 * Hub model groups are stored in Redux so refreshes from team hub changes propagate
 * to every consumer of this hook.
 *
 * @returns AI availability flag, loaded settings for chat initialization, and loading state.
 */
export function useAiAvailability(): {
  aiAvailable: boolean;
  aiSettings: AiSettings;
  loading: boolean;
} {
  const dispatch = useAppDispatch();
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches personal API keys and hub LLM models on mount.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      try {
        const value = await window.api.getAiSettings();
        await dispatch(refreshHubLlmModels()).unwrap();
        if (!cancelled) {
          setAiSettings(value);
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
  }, [dispatch]);

  return {
    aiAvailable: !loading && hasAvailableAiModels(aiSettings, hubModelGroups),
    aiSettings,
    loading
  };
}
