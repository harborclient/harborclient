import { type ClientOptions } from 'openai';
import type { AiSettings, LlmProvider } from '#/shared/types';

const CLAUDE_BASE_URL = 'https://api.anthropic.com/v1/';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

/**
 * User-facing label for each LLM provider, used in configuration errors.
 */
const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  gemini: 'Google Gemini',
  github: 'GitHub Models'
};

/**
 * Resolves OpenAI SDK client options for the chosen provider and stored API keys.
 *
 * @param provider - LLM provider to configure.
 * @param settings - Persisted AI provider API keys.
 * @returns Client options suitable for `new OpenAI(...)`.
 * @throws When the selected provider's API key is missing or blank.
 */
export function resolveLlmClientOptions(
  provider: LlmProvider,
  settings: AiSettings
): ClientOptions {
  switch (provider) {
    case 'openai': {
      const apiKey = settings.openaiApiKey.trim();
      if (!apiKey) {
        throw new Error(
          `${PROVIDER_LABELS.openai} API key is not configured. Add it in Settings → AI.`
        );
      }
      return { apiKey };
    }
    case 'claude': {
      const apiKey = settings.claudeApiKey.trim();
      if (!apiKey) {
        throw new Error(
          `${PROVIDER_LABELS.claude} API key is not configured. Add it in Settings → AI.`
        );
      }
      return { apiKey, baseURL: CLAUDE_BASE_URL };
    }
    case 'gemini': {
      const apiKey = settings.geminiApiKey.trim();
      if (!apiKey) {
        throw new Error(
          `${PROVIDER_LABELS.gemini} API key is not configured. Add it in Settings → AI.`
        );
      }
      return { apiKey, baseURL: GEMINI_BASE_URL };
    }
    case 'github': {
      throw new Error(
        'GitHub Models credentials must be resolved asynchronously via LlmClientFactory.'
      );
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
}
