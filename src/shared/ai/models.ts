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
   * Stable selection key for the dropdown, unique across sources.
   *
   * Defaults to {@link id}. When a Team Hub and a personal key both offer the
   * same model id, the personal entry uses `personal:<id>` so the two remain
   * independently selectable even though they send the same provider {@link id}.
   */
  value: string;

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
 * Section header and models for a grouped model dropdown.
 */
export interface AiModelOptionGroup {
  /**
   * Stable React key for the optgroup.
   */
  key: string;

  /**
   * Visible optgroup label in the dropdown.
   */
  label: string;

  /**
   * Selectable models within this section.
   */
  models: AiModelOption[];
}

/**
 * Catalog of supported AI models grouped by provider.
 */
export const AI_MODELS: Omit<AiModelOption, 'source' | 'value'>[] = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'claude' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'gemini' }
];

/**
 * Catalog of GitHub Models offered when the user is signed in with GitHub.
 */
export const GITHUB_MODELS: Omit<AiModelOption, 'source' | 'value'>[] = [
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'github' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'github' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'github' },
  { id: 'meta/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', provider: 'github' },
  { id: 'deepseek/DeepSeek-R1', label: 'DeepSeek R1', provider: 'github' }
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
    case 'github':
      return false;
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
 * @param githubConnected - Whether GitHub Models sign-in is active.
 */
export function getAvailableModels(
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = [],
  githubConnected = false
): AiModelOption[] {
  const hubModels = indexHubModels(hubGroups);
  const options: AiModelOption[] = [];
  const includedIds = new Set<string>();

  for (const model of AI_MODELS) {
    const hub = hubModels.get(model.id);
    if (hub) {
      options.push({
        ...model,
        value: model.id,
        label: model.label,
        source: 'hub',
        hubId: hub.hubId,
        hubName: hub.hubName
      });
      includedIds.add(model.id);

      // Surface the personal-key route too, so a Team Hub offering the same
      // model id does not hide the direct provider option from the user.
      if (hasProviderKey(settings, model.provider)) {
        options.push({
          ...model,
          value: `personal:${model.id}`,
          label: model.label,
          source: 'personal'
        });
      }
      continue;
    }

    if (hasProviderKey(settings, model.provider)) {
      options.push({
        ...model,
        value: model.id,
        label: model.label,
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
        value: model.id,
        label: model.label,
        provider: model.provider,
        source: 'hub',
        hubId: group.hubId,
        hubName: group.hubName
      });
      includedIds.add(model.id);
    }
  }

  if (githubConnected) {
    for (const model of GITHUB_MODELS) {
      if (includedIds.has(model.id)) {
        continue;
      }
      options.push({
        ...model,
        value: model.id,
        label: model.label,
        source: 'personal'
      });
      includedIds.add(model.id);
    }
  }

  return options;
}

/**
 * Returns the dropdown section label for one selectable model option.
 *
 * @param model - Model option from {@link getAvailableModels}.
 */
export function getAiModelOptionGroupLabel(model: AiModelOption): string {
  if (model.source === 'hub') {
    return model.hubName ?? 'Team Hub';
  }

  if (model.provider === 'github') {
    return 'GitHub Models';
  }

  return 'Personal';
}

/**
 * Groups flat model options into optgroup sections while preserving list order.
 *
 * @param models - Models from {@link getAvailableModels}.
 */
export function groupAvailableModels(models: AiModelOption[]): AiModelOptionGroup[] {
  const groups: AiModelOptionGroup[] = [];
  const groupIndex = new Map<string, number>();

  for (const model of models) {
    const label = getAiModelOptionGroupLabel(model);
    const key =
      model.source === 'hub' && model.hubId != null ? `hub:${model.hubId}` : label.toLowerCase();
    const existingIndex = groupIndex.get(key);

    if (existingIndex !== undefined) {
      groups[existingIndex]?.models.push(model);
      continue;
    }

    groupIndex.set(key, groups.length);
    groups.push({ key, label, models: [model] });
  }

  return groups;
}

/**
 * Returns true when at least one chat model is available from hubs or personal keys.
 *
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 * @param githubConnected - Whether GitHub Models sign-in is active.
 */
export function hasAvailableAiModels(
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = [],
  githubConnected = false
): boolean {
  return getAvailableModels(settings, hubGroups, githubConnected).length > 0;
}

/**
 * Looks up a catalog model by its provider-specific id.
 *
 * @param modelId - Model id from the chat composer or persisted chat record.
 * @returns The matching catalog entry, or undefined when unknown.
 */
export function getAiModelById(
  modelId: string
): Omit<AiModelOption, 'source' | 'value'> | undefined {
  return (
    AI_MODELS.find((model) => model.id === modelId) ??
    GITHUB_MODELS.find((model) => model.id === modelId)
  );
}

/**
 * Resolves a selectable model option including hub routing metadata.
 *
 * @param modelId - Model id selected in the composer.
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 * @param githubConnected - Whether GitHub Models sign-in is active.
 */
export function resolveAiModelOption(
  modelId: string,
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = [],
  githubConnected = false
): AiModelOption | undefined {
  const models = getAvailableModels(settings, hubGroups, githubConnected);
  // Prefer an exact selection-key match; fall back to raw id for chats persisted
  // before disambiguation keys existed.
  return (
    models.find((model) => model.value === modelId) ?? models.find((model) => model.id === modelId)
  );
}
