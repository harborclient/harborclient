import type { AiModelOption } from '#/shared/ai/models';

const STORAGE_KEY = 'harborclient.gitCommitMessageModelId';

/**
 * Resolves the model id for git commit message generation.
 *
 * @param availableModels - Models the user can select right now.
 * @param preferredFromChat - Active chat model id used as fallback when nothing is stored.
 * @returns Selected model id, or empty string when no models are available.
 */
export function resolveGitCommitMessageModelId(
  availableModels: AiModelOption[],
  preferredFromChat?: string
): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && availableModels.some((model) => model.id === stored)) {
    return stored;
  }

  if (preferredFromChat && availableModels.some((model) => model.id === preferredFromChat)) {
    return preferredFromChat;
  }

  return availableModels[0]?.id ?? '';
}

/**
 * Persists the last model used for a successful git commit message generation.
 *
 * @param modelId - Model id to remember for future generations.
 */
export function persistGitCommitMessageModelId(modelId: string): void {
  if (modelId.trim()) {
    localStorage.setItem(STORAGE_KEY, modelId);
  }
}
