import { getAiModelOptionGroupLabel, getAvailableModels, type AiModelOption } from './models';
import type { AiSettings, HubLlmModelGroup } from '../types';

/**
 * Parsed `hc.ask` model selection string (`"model"` or `"model: source"`).
 */
export interface ScriptAskModelSpec {
  /**
   * Model label or provider id when present.
   */
  model?: string;

  /**
   * Source group label when present (`Personal`, `GitHub Models`, or a Team Hub name).
   */
  source?: string;
}

/**
 * Parses an optional `hc.ask` model selection string.
 *
 * Splits on the first `:`. Empty model after trim throws; empty source means
 * source was omitted.
 *
 * @param spec - Optional `"model"` or `"model: source"` string.
 * @returns Parsed model/source segments (both may be undefined).
 * @throws When the model segment is empty after parsing a non-empty spec.
 */
export function parseScriptAskModelSpec(spec?: string): ScriptAskModelSpec {
  if (spec == null) {
    return {};
  }

  const trimmed = spec.trim();
  if (!trimmed) {
    return {};
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex < 0) {
    return { model: trimmed };
  }

  const model = trimmed.slice(0, colonIndex).trim();
  const source = trimmed.slice(colonIndex + 1).trim();

  if (!model) {
    throw new Error('hc.ask model selection requires a model name before ":"');
  }

  return {
    model,
    ...(source ? { source } : {})
  };
}

/**
 * Finds the first available model matching a label or provider id.
 *
 * @param available - Models from {@link getAvailableModels}.
 * @param modelText - Model label or provider id.
 * @returns Matching option, or undefined.
 */
function findModelByNameOrId(
  available: AiModelOption[],
  modelText: string
): AiModelOption | undefined {
  const modelLower = modelText.toLowerCase();
  const byLabel = available.find((option) => option.label.toLowerCase() === modelLower);
  if (byLabel) {
    return byLabel;
  }
  return available.find((option) => option.id.toLowerCase() === modelLower);
}

/**
 * Resolves a script `hc.ask` model selection to a selectable AI option.
 *
 * - No model → first available model
 * - Model only → first match by label or id across all sources
 * - Model + source → match within that source group (case-insensitive group label)
 *
 * @param spec - Optional `"model"` or `"model: source"` selection string.
 * @param settings - Stored AI provider API keys.
 * @param hubGroups - Models exposed by configured Team Hubs.
 * @param githubConnected - Whether GitHub Models sign-in is active.
 * @returns Matching option, or undefined when AI is unavailable or no match exists.
 */
export function resolveScriptAskModel(
  spec: string | undefined,
  settings: AiSettings,
  hubGroups: HubLlmModelGroup[] = [],
  githubConnected = false
): AiModelOption | undefined {
  const available = getAvailableModels(settings, hubGroups, githubConnected);
  if (available.length === 0) {
    return undefined;
  }

  const parsed = parseScriptAskModelSpec(spec);
  if (!parsed.model) {
    return available[0];
  }

  if (!parsed.source) {
    return findModelByNameOrId(available, parsed.model);
  }

  const sourceLower = parsed.source.toLowerCase();
  const inSource = available.filter(
    (option) => getAiModelOptionGroupLabel(option).toLowerCase() === sourceLower
  );
  if (inSource.length === 0) {
    return undefined;
  }

  return findModelByNameOrId(inSource, parsed.model);
}
