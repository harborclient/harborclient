import { describe, expect, it } from 'vitest';
import { gitRemoteHostname, isGitHubRepositoryUrl } from '#/shared/gitUrl';

describe('gitRemoteHostname', () => {
  it('extracts hostname from absolute HTTPS URLs', () => {
    expect(gitRemoteHostname('https://github.com/org/repo.git')).toBe('github.com');
  });

  it('extracts hostname from host/path values without a scheme', () => {
    expect(gitRemoteHostname('github.com/org/repo')).toBe('github.com');
  });

  it('returns null for blank or unparseable values', () => {
    expect(gitRemoteHostname('')).toBeNull();
    expect(gitRemoteHostname('   ')).toBeNull();
    expect(gitRemoteHostname('not a url')).toBeNull();
  });
});

describe('isGitHubRepositoryUrl', () => {
  it('returns true for github.com repository URLs', () => {
    expect(isGitHubRepositoryUrl('https://github.com/org/repo.git')).toBe(true);
    expect(isGitHubRepositoryUrl('github.com/org/repo')).toBe(true);
    expect(isGitHubRepositoryUrl('https://GitHub.com/org/repo.git')).toBe(true);
  });

  it('returns false for lookalike or non-GitHub hostnames', () => {
    expect(isGitHubRepositoryUrl('https://notgithub.com/foo')).toBe(false);
    expect(isGitHubRepositoryUrl('https://github.com.evil.test/foo')).toBe(false);
    expect(isGitHubRepositoryUrl('https://evilgithub.com/foo')).toBe(false);
    expect(isGitHubRepositoryUrl('https://gitlab.com/foo')).toBe(false);
  });

  it('returns false for blank or unparseable values', () => {
    expect(isGitHubRepositoryUrl('')).toBe(false);
    expect(isGitHubRepositoryUrl('not a url')).toBe(false);
  });
});
