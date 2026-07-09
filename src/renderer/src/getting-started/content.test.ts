import { describe, expect, it } from 'vitest';
import {
  GETTING_STARTED_DEFAULT_DOC,
  getGettingStartedDocContent,
  isExternalGettingStartedHref,
  listGettingStartedDocPaths,
  normalizeGettingStartedPath,
  resolveGettingStartedRelativePath
} from './content';

describe('getting-started content helpers', () => {
  it('normalizes glob-style paths', () => {
    expect(normalizeGettingStartedPath('./index.md')).toBe('index.md');
    expect(normalizeGettingStartedPath('guides\\setup.md')).toBe('guides/setup.md');
  });

  it('resolves relative markdown and asset paths', () => {
    expect(resolveGettingStartedRelativePath('index.md', 'guides/environments.md')).toBe(
      'guides/environments.md'
    );
    expect(resolveGettingStartedRelativePath('guides/setup.md', '../assets/logo.png')).toBe(
      'assets/logo.png'
    );
  });

  it('detects external hrefs', () => {
    expect(isExternalGettingStartedHref('https://harborclient.com/')).toBe(true);
    expect(isExternalGettingStartedHref('environments.md')).toBe(false);
    expect(isExternalGettingStartedHref('#section')).toBe(true);
  });

  it('loads bundled index.md content', () => {
    const content = getGettingStartedDocContent(GETTING_STARTED_DEFAULT_DOC);
    expect(content).toContain('# Getting Started with HarborClient');
  });

  it('lists bundled markdown paths including index.md', () => {
    expect(listGettingStartedDocPaths()).toContain('index.md');
  });
});
