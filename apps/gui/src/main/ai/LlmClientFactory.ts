import OpenAI from 'openai';
import { getValidGithubModelsAccessToken } from './githubModelsAuth';
import { resolveLlmClientOptions } from './llmClientOptions';
import { getAiSettings } from '#/main/settings/aiSettings';
import type { LlmProvider } from '#/shared/types';

const GITHUB_MODELS_BASE_URL = 'https://models.github.ai/inference';
const GITHUB_API_VERSION = '2026-03-10';

/**
 * Creates OpenAI SDK clients configured for OpenAI, Claude, Gemini, or GitHub Models.
 */
export class LlmClientFactory {
  /**
   * Builds an OpenAI SDK client for the requested provider using persisted credentials.
   *
   * Claude and Gemini use each vendor's OpenAI-compatible API endpoint.
   * GitHub Models uses the user's GitHub App OAuth token.
   *
   * @param provider - LLM provider to initialize.
   * @returns Configured OpenAI client instance.
   * @throws When the selected provider's credentials are not configured.
   */
  async factory(provider: LlmProvider): Promise<OpenAI> {
    if (provider === 'github') {
      const apiKey = await getValidGithubModelsAccessToken();
      return new OpenAI({
        apiKey,
        baseURL: GITHUB_MODELS_BASE_URL,
        defaultHeaders: {
          'X-GitHub-Api-Version': GITHUB_API_VERSION
        }
      });
    }

    const options = resolveLlmClientOptions(provider, getAiSettings());
    return new OpenAI(options);
  }
}
