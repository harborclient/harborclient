import type { ChatStepMessage } from '#/shared/types';

/**
 * Default commit message shown before the user edits or generates one.
 */
export const DEFAULT_GIT_COMMIT_MESSAGE = 'Update HarborClient collections';

/**
 * Maximum length for AI-generated commit subject lines.
 */
export const GIT_COMMIT_MESSAGE_MAX_LENGTH = 72;

/**
 * Returns whether a commit message draft can be replaced by AI output.
 *
 * @param value - Current textarea value.
 */
export function canReplaceGitCommitMessage(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === DEFAULT_GIT_COMMIT_MESSAGE;
}

/**
 * Normalizes raw commit message text from the model.
 *
 * @param raw - Assistant text or tool output.
 * @returns Single-line commit subject suitable for the commit textarea.
 */
export function normalizeGitCommitMessage(raw: string): string {
  const firstLine = raw
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '';
  }

  let normalized = firstLine.replace(/\s+/g, ' ');
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/[.!?;:]+$/, '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= GIT_COMMIT_MESSAGE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, GIT_COMMIT_MESSAGE_MAX_LENGTH - 1)}…`;
}

/**
 * Builds the system prompt for AI git commit message generation.
 *
 * @returns System prompt instructing the model to inspect git_diff and return one subject line.
 */
export function buildGitCommitMessageSystemPrompt(): string {
  return `You write concise git commit subject lines for HarborClient repository changes.

Rules:
1. Call git_diff with the provided collectionUuid before writing the commit message.
2. Summarize all uncommitted changes in the repository, not just one collection folder.
3. Return exactly one commit subject line in imperative mood (for example "Add OAuth refresh handling").
4. Do not include a commit body, bullet list, quotes, or trailing punctuation.
5. Keep the subject to 72 characters or fewer.
6. Do not call any tools other than git_diff.`;
}

/**
 * Builds the initial user message for commit message generation.
 *
 * @param connectionName - Display name of the git connection.
 * @param collectionUuid - Collection uuid used to resolve the git repository.
 */
export function buildGitCommitMessageUserPrompt(
  connectionName: string,
  collectionUuid: string
): string {
  return `Generate a git commit message for repository "${connectionName}". Use collectionUuid "${collectionUuid}" when calling git_diff.`;
}

/**
 * Builds the conversation messages for the commit-message agent loop.
 *
 * @param connectionName - Display name of the git connection.
 * @param collectionUuid - Collection uuid passed to git_diff.
 */
export function buildGitCommitMessageMessages(
  connectionName: string,
  collectionUuid: string
): ChatStepMessage[] {
  return [
    {
      role: 'user',
      content: buildGitCommitMessageUserPrompt(connectionName, collectionUuid)
    }
  ];
}
