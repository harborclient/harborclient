import type { HubLlmModelGroup, LlmProvider } from '#/shared/types/ai';
import type { AiSettings } from '#/shared/types/settings';

/**
 * Whether a chat model is sourced from a personal API key or a Team Hub.
 */
export type AiModelSource = 'personal' | 'hub';

/**
 * Selectable AI model exposed in the chat composer.
 */
export interface AiModelOption {
  /**
   * Provider-specific model id sent to the API.
   */
  id: string;

  /**
   * Human-readable label for the model dropdown.
   */
  label: string;

  /**
   * LLM provider that owns this model.
   */
  provider: LlmProvider;

  /**
   * Whether the model uses a personal API key or a Team Hub proxy.
   */
  source: AiModelSource;

  /**
   * Team Hub id when {@link source} is `hub`.
   */
  hubId?: string;

  /**
   * Team Hub display name when {@link source} is `hub`.
   */
  hubName?: string;
}

/**
 * Catalog of supported AI models grouped by provider.
 */
export const AI_MODELS: Omit<AiModelOption, 'source'>[] = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'claude' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'gemini' }
];

/**
 * Returns whether a provider has a configured API key.
 *
 * @param settings - Stored AI provider API keys.
 * @param provider - Provider to check.
 */
function hasProviderKey(settings: AiSettings, provider: LlmProvider): boolean {
  switch (provider) {
    case 'openai':
      return settings.openaiApiKey.trim().length > 0;
    case 'claude':
      return settings.claudeApiKey.trim().length > 0;
    case 'gemini':
      return settings.geminiApiKey.trim().length > 0;
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
}

/**
 * Indexes hub-offered models by id, preferring the first configured hub per model.
 *
 * @param hubGroups - Models returned from connected Team Hubs.
 */
function indexHubModels(
  hubGroups: HubLlmModelGroup[]
): Map<string, { hubId: string; hubName: string }> {
  const indexed = new Map<string, { hubId: string; hubName: string }>();

  for (const group of hubGroups) {
    for (const model of group.models) {
      if (!indexed.has(model.id)) {
        indexed.set(model.id, { hubId: group.hubId, hubName: group.hubName });
      }
    }
  }

  return indexed;
}

/**
 * Returns chat models available from Team Hubs and personal API keys.
 *
 * Hub models are preferred when both a hub and a personal key offer the same id.
 *
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 */
export function getAvailableModels(
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = []
): AiModelOption[] {
  const hubModels = indexHubModels(hubGroups);
  const options: AiModelOption[] = [];
  const includedIds = new Set<string>();

  for (const model of AI_MODELS) {
    const hub = hubModels.get(model.id);
    if (hub) {
      options.push({
        ...model,
        label: `${model.label} (Team Hub)`,
        source: 'hub',
        hubId: hub.hubId,
        hubName: hub.hubName
      });
      includedIds.add(model.id);
      continue;
    }

    if (hasProviderKey(settings, model.provider)) {
      options.push({
        ...model,
        label: `${model.label} (Personal)`,
        source: 'personal'
      });
      includedIds.add(model.id);
    }
  }

  for (const group of hubGroups) {
    for (const model of group.models) {
      if (includedIds.has(model.id)) {
        continue;
      }

      options.push({
        id: model.id,
        label: `${model.label} (Team Hub)`,
        provider: model.provider,
        source: 'hub',
        hubId: group.hubId,
        hubName: group.hubName
      });
      includedIds.add(model.id);
    }
  }

  return options;
}

/**
 * Returns true when at least one chat model is available from hubs or personal keys.
 *
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 */
export function hasAvailableAiModels(
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = []
): boolean {
  return getAvailableModels(settings, hubGroups).length > 0;
}

/**
 * Looks up a catalog model by its provider-specific id.
 *
 * @param modelId - Model id from the chat composer or persisted chat record.
 * @returns The matching catalog entry, or undefined when unknown.
 */
export function getAiModelById(modelId: string): Omit<AiModelOption, 'source'> | undefined {
  return AI_MODELS.find((model) => model.id === modelId);
}

/**
 * Resolves a selectable model option including hub routing metadata.
 *
 * @param modelId - Model id selected in the composer.
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 */
export function resolveAiModelOption(
  modelId: string,
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = []
): AiModelOption | undefined {
  return getAvailableModels(settings, hubGroups).find((model) => model.id === modelId);
}
