import { describe, expect, it } from 'vitest';
import {
  gitRemoteHostname,
  isGitHubRepositoryUrl,
  normalizeGitHostKey,
  normalizeGitRemoteToHttps
} from './gitUrl';

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

describe('normalizeGitHostKey', () => {
  it('returns a lowercase hostname from HTTPS repository URLs', () => {
    expect(normalizeGitHostKey('https://github.com/org/repo.git')).toBe('github.com');
    expect(normalizeGitHostKey('https://GitLab.com/org/repo.git')).toBe('gitlab.com');
  });

  it('returns a lowercase hostname from bare host/path values', () => {
    expect(normalizeGitHostKey('github.com/org/repo')).toBe('github.com');
  });

  it('returns null for blank or unparseable values', () => {
    expect(normalizeGitHostKey('')).toBeNull();
    expect(normalizeGitHostKey('   ')).toBeNull();
    expect(normalizeGitHostKey('not a url')).toBeNull();
  });
});

describe('normalizeGitRemoteToHttps', () => {
  it('returns HTTPS URLs unchanged', () => {
    expect(normalizeGitRemoteToHttps('https://github.com/org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    );
    expect(normalizeGitRemoteToHttps('http://gitlab.com/org/repo.git')).toBe(
      'http://gitlab.com/org/repo.git'
    );
  });

  it('converts scp-style SSH remotes to HTTPS', () => {
    expect(normalizeGitRemoteToHttps('git@github.com:org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    );
  });

  it('converts ssh:// remotes to HTTPS', () => {
    expect(normalizeGitRemoteToHttps('ssh://git@github.com/org/repo.git')).toBe(
      'https://github.com/org/repo.git'
    );
  });

  it('returns trimmed input for unrecognized formats', () => {
    expect(normalizeGitRemoteToHttps('  file:///tmp/repo  ')).toBe('file:///tmp/repo');
    expect(normalizeGitRemoteToHttps('')).toBe('');
  });
});
