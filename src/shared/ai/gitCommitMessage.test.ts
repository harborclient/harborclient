import { describe, expect, it } from 'vitest';
import {
  buildGitCommitMessageSystemPrompt,
  canReplaceGitCommitMessage,
  DEFAULT_GIT_COMMIT_MESSAGE,
  normalizeGitCommitMessage
} from '#/shared/ai/gitCommitMessage';

describe('canReplaceGitCommitMessage', () => {
  it('allows replacement for empty and default messages', () => {
    expect(canReplaceGitCommitMessage('')).toBe(true);
    expect(canReplaceGitCommitMessage('   ')).toBe(true);
    expect(canReplaceGitCommitMessage(DEFAULT_GIT_COMMIT_MESSAGE)).toBe(true);
  });

  it('blocks replacement for user-written messages', () => {
    expect(canReplaceGitCommitMessage('Fix OAuth refresh flow')).toBe(false);
  });
});

describe('normalizeGitCommitMessage', () => {
  it('uses the first non-empty line and strips trailing punctuation', () => {
    expect(normalizeGitCommitMessage('Add OAuth refresh handling.\n\nMore detail')).toBe(
      'Add OAuth refresh handling'
    );
  });

  it('removes wrapping quotes', () => {
    expect(normalizeGitCommitMessage('"Update request scripts"')).toBe('Update request scripts');
  });

  it('truncates long subjects', () => {
    const longMessage =
      'This commit message is intentionally much longer than the allowed git subject length';
    expect(normalizeGitCommitMessage(longMessage).length).toBeLessThanOrEqual(72);
    expect(normalizeGitCommitMessage(longMessage).endsWith('…')).toBe(true);
  });

  it('returns empty string for blank input', () => {
    expect(normalizeGitCommitMessage('   ')).toBe('');
  });
});

describe('buildGitCommitMessageSystemPrompt', () => {
  it('instructs the model to call git_diff', () => {
    const prompt = buildGitCommitMessageSystemPrompt();

    expect(prompt).toContain('git_diff');
    expect(prompt).toContain('collectionUuid');
  });
});
