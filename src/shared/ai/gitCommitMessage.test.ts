import { describe, expect, it } from 'vitest';
import {
  buildGitCommitMessageSystemPrompt,
  canReplaceGitCommitMessage,
  DEFAULT_GIT_COMMIT_MESSAGE,
  GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS,
  normalizeGitCommitMessage
} from './gitCommitMessage';

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

  it('preserves up to five request bullet lines after the subject', () => {
    const raw = `Update request scripts

- Get Users: add auth header
- Create Order: update URL path
* Delete Item: remove unused param`;

    expect(normalizeGitCommitMessage(raw)).toBe(
      'Update request scripts\n\n- Get Users: add auth header\n- Create Order: update URL path\n- Delete Item: remove unused param'
    );
  });

  it('truncates request bullets to five entries', () => {
    const bullets = Array.from(
      { length: 7 },
      (_, index) => `- Request ${index + 1}: change ${index + 1}`
    ).join('\n');
    const raw = `Update multiple requests\n\n${bullets}`;

    const normalized = normalizeGitCommitMessage(raw);
    const bulletLines = normalized.split('\n').filter((line) => line.startsWith('- '));

    expect(bulletLines).toHaveLength(GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS);
    expect(normalized.startsWith('Update multiple requests\n\n')).toBe(true);
  });

  it('drops non-bullet body lines', () => {
    const raw = `Add OAuth refresh handling

These requests were updated in this commit.
- Get Users: add auth header`;

    expect(normalizeGitCommitMessage(raw)).toBe(
      'Add OAuth refresh handling\n\n- Get Users: add auth header'
    );
  });
});

describe('buildGitCommitMessageSystemPrompt', () => {
  it('instructs the model to call git_diff and list changed requests', () => {
    const prompt = buildGitCommitMessageSystemPrompt();

    expect(prompt).toContain('git_diff');
    expect(prompt).toContain('collectionUuid');
    expect(prompt).toContain('requests/');
    expect(prompt).toContain(String(GIT_COMMIT_MESSAGE_MAX_REQUEST_BULLETS));
  });
});
