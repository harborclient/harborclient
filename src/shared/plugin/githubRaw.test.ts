import { describe, expect, it } from 'vitest';
import { buildGitHubRawContentUrl, parseGitHubRepo } from './githubRaw';

describe('parseGitHubRepo', () => {
  it('parses a standard GitHub repository URL', () => {
    expect(parseGitHubRepo('https://github.com/harborclient/plugin-curl')).toEqual({
      owner: 'harborclient',
      repo: 'plugin-curl'
    });
  });

  it('accepts repository URLs ending in .git', () => {
    expect(parseGitHubRepo('https://github.com/example/my-plugin.git')).toEqual({
      owner: 'example',
      repo: 'my-plugin'
    });
  });

  it('returns null for non-GitHub hosts', () => {
    expect(parseGitHubRepo('https://gitlab.com/example/my-plugin')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(parseGitHubRepo('not-a-url')).toBeNull();
  });
});

describe('buildGitHubRawContentUrl', () => {
  it('builds a raw content URL for a repository file', () => {
    expect(
      buildGitHubRawContentUrl(
        'https://github.com/harborclient/plugin-curl',
        'main',
        'manifest.json'
      )
    ).toBe('https://raw.githubusercontent.com/harborclient/plugin-curl/main/manifest.json');
  });

  it('strips leading slashes from relative paths', () => {
    expect(
      buildGitHubRawContentUrl(
        'https://github.com/harborclient/plugin-curl.git',
        'v1.0.0',
        '/README.md'
      )
    ).toBe('https://raw.githubusercontent.com/harborclient/plugin-curl/v1.0.0/README.md');
  });

  it('rejects path traversal segments', () => {
    expect(
      buildGitHubRawContentUrl('https://github.com/example/demo', 'main', '../secret.txt')
    ).toBeNull();
  });

  it('returns null for non-GitHub repository URLs', () => {
    expect(
      buildGitHubRawContentUrl('https://example.com/repo', 'main', 'manifest.json')
    ).toBeNull();
  });
});
