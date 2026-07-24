import type { AiSettings } from '#/shared/types/settings';

/**
 * Returns whether at least one AI provider API key is configured.
 *
 * @param settings - Stored AI provider API keys.
 */
export function hasConfiguredAiApiKeys(settings: AiSettings): boolean {
  return (
    settings.openaiApiKey.trim().length > 0 ||
    settings.claudeApiKey.trim().length > 0 ||
    settings.geminiApiKey.trim().length > 0
  );
}
