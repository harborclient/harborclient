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
 * Maximum number of changed-request bullet lines in an AI-generated commit body.
 */
export const GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS = 5;

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
 * Normalizes a single commit subject line from the model.
 *
 * @param line - First non-empty line of the raw commit message.
 * @returns Imperative subject without quotes or trailing punctuation, capped at 72 characters.
 */
function normalizeGitCommitSubjectLine(line: string): string {
  let normalized = line.replace(/\s+/g, ' ');
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
 * Normalizes a bullet line from the commit body to a leading "- " prefix.
 *
 * @param line - Trimmed line that may start with "-" or "*".
 * @returns Normalized bullet text, or null when the line is not a bullet.
 */
function normalizeGitCommitBulletLine(line: string): string | null {
  const match = line.match(/^([-*])\s*(.+)$/);
  if (!match) {
    return null;
  }

  const content = match[2].replace(/\s+/g, ' ').trim();
  if (!content) {
    return null;
  }

  return `- ${content}`;
}

/**
 * Normalizes raw commit message text from the model.
 *
 * @param raw - Assistant text or tool output.
 * @returns Commit subject, optionally followed by a blank line and up to five request bullets.
 */
export function normalizeGitCommitMessage(raw: string): string {
  const lines = raw
    .trim()
    .split('\n')
    .map((line) => line.trim());
  const subjectLineIndex = lines.findIndex((line) => line.length > 0);

  if (subjectLineIndex === -1) {
    return '';
  }

  const subject = normalizeGitCommitSubjectLine(lines[subjectLineIndex] ?? '');
  if (!subject) {
    return '';
  }

  const bullets: string[] = [];
  for (let index = subjectLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line) {
      continue;
    }

    const bullet = normalizeGitCommitBulletLine(line);
    if (bullet) {
      bullets.push(bullet);
    }
  }

  const cappedBullets = bullets.slice(0, GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS);
  if (cappedBullets.length === 0) {
    return subject;
  }

  return `${subject}\n\n${cappedBullets.join('\n')}`;
}

/**
 * Builds the system prompt for AI git commit message generation.
 *
 * @returns System prompt instructing the model to inspect git_diff and return a subject with request bullets.
 */
export function buildGitCommitMessageSystemPrompt(): string {
  return `You write concise git commit messages for HarborClient repository changes.

Rules:
1. Call git_diff with the provided collectionUuid before writing the commit message.
2. Summarize all uncommitted changes in the repository, not just one collection folder.
3. Return exactly one commit subject line in imperative mood (for example "Add OAuth refresh handling").
4. Keep the subject to 72 characters or fewer. Do not wrap it in quotes or end it with trailing punctuation.
5. After the subject, add one blank line, then a bullet list of changed saved requests when any request files under a requests/ directory were added, modified, or deleted.
6. Each bullet must use the format "- <Request Name>: <short description>" where Request Name comes from the request JSON name field in the diff (fall back to the file slug when the name is not visible).
7. Keep each bullet description very short (a few words).
8. Include at most ${GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS} request bullets. When more than ${GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS} request files changed, list only the ${GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS} most significant and omit the rest without noting that anything was left out.
9. When no request files changed, return only the subject line with no blank line or bullet list.
10. Do not call any tools other than git_diff.`;
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
