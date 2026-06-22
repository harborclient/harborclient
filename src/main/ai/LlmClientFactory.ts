import OpenAI from 'openai';
import { resolveLlmClientOptions } from '#/main/ai/llmClientOptions';
import { getAiSettings } from '#/main/settings/aiSettings';
import type { LlmProvider } from '#/shared/types';

/**
 * Creates OpenAI SDK clients configured for OpenAI, Claude, or Gemini.
 */
export class LlmClientFactory {
  /**
   * Builds an OpenAI SDK client for the requested provider using persisted API keys.
   *
   * Claude and Gemini use each vendor's OpenAI-compatible API endpoint.
   *
   * @param provider - LLM provider to initialize.
   * @returns Configured OpenAI client instance.
   * @throws When the selected provider's API key is not configured.
   */
  factory(provider: LlmProvider): OpenAI {
    const options = resolveLlmClientOptions(provider, getAiSettings());
    return new OpenAI(options);
  }
}
