import { describe, expect, it } from 'vitest';
import {
  buildGitHubRawContentUrl,
  parseGitHubRepo,
  resolveCatalogScreenshotUrls,
  resolveScreenshotUrl
} from './githubRaw';

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

describe('resolveScreenshotUrl', () => {
  it('passes absolute HTTP(S) URLs through unchanged', () => {
    expect(
      resolveScreenshotUrl(
        'https://example.com/shot.png',
        'https://github.com/harborclient/theme-nord',
        'v1.0.6'
      )
    ).toBe('https://example.com/shot.png');
  });

  it('resolves relative paths against the listing repo and ref', () => {
    expect(
      resolveScreenshotUrl(
        'screenshot.png',
        'https://github.com/harborclient/theme-ayu-mirage',
        'v1.0.2'
      )
    ).toBe('https://raw.githubusercontent.com/harborclient/theme-ayu-mirage/v1.0.2/screenshot.png');
  });

  it('defaults the ref to main when omitted', () => {
    expect(resolveScreenshotUrl('assets/preview.png', 'https://github.com/example/demo')).toBe(
      'https://raw.githubusercontent.com/example/demo/main/assets/preview.png'
    );
  });

  it('returns null for empty values', () => {
    expect(resolveScreenshotUrl('  ', 'https://github.com/example/demo', 'main')).toBeNull();
  });
});

describe('resolveCatalogScreenshotUrls', () => {
  it('prefers plural screenshots over the singular field', () => {
    expect(
      resolveCatalogScreenshotUrls(
        'https://github.com/example/demo',
        'v1.0.0',
        ['screenshot.png', 'https://example.com/b.png'],
        'ignored.png'
      )
    ).toEqual([
      'https://raw.githubusercontent.com/example/demo/v1.0.0/screenshot.png',
      'https://example.com/b.png'
    ]);
  });

  it('falls back to the singular screenshot when plural is empty', () => {
    expect(
      resolveCatalogScreenshotUrls(
        'https://github.com/example/demo',
        'main',
        undefined,
        'screenshot.png'
      )
    ).toEqual(['https://raw.githubusercontent.com/example/demo/main/screenshot.png']);
  });

  it('returns an empty array when no screenshots are declared', () => {
    expect(resolveCatalogScreenshotUrls('https://github.com/example/demo', 'main')).toEqual([]);
  });
});
