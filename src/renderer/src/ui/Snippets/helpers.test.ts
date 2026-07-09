import { describe, expect, it, vi } from 'vitest';
import type { SnippetCatalog, SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';
import { resolvePendingSnippetInstallDeepLink } from '#/renderer/src/ui/Snippets/helpers';

const sampleEntry: SnippetCatalogEntry = {
  id: 'com.harborclient.snippets.testing',
  name: 'Testing Snippets',
  version: '1.0.0',
  summary: 'Reusable snippets for request testing.',
  author: 'HarborClient',
  categories: ['testing'],
  repoUrl: 'https://github.com/harborclient/snippet-testing',
  snippets: [
    { name: 'Assert status', phase: 'post-request', stage: 'main', file: 'assert-status.js' }
  ]
};

const sampleCatalog: SnippetCatalog = {
  schemaVersion: 1,
  snippets: [sampleEntry]
};

describe('resolvePendingSnippetInstallDeepLink', () => {
  it('asks for confirmation before installing an uninstalled snippet bundle', async () => {
    const confirmInstall = vi.fn(async () => true);
    const installFromGit = vi.fn(
      async (): Promise<InstalledSnippetPackage> => ({
        catalogId: sampleEntry.id,
        name: sampleEntry.name,
        version: sampleEntry.version,
        snippetCount: 1
      })
    );

    const result = await resolvePendingSnippetInstallDeepLink(sampleEntry.id, {
      getSnippetCatalog: async () => sampleCatalog,
      listInstalledPackages: async () => [],
      confirmInstall,
      installFromGit,
      isCancelled: () => false
    });

    expect(confirmInstall).toHaveBeenCalledOnce();
    expect(confirmInstall).toHaveBeenCalledWith(sampleEntry);
    expect(installFromGit).toHaveBeenCalledOnce();
    expect(result).toEqual({
      kind: 'installed',
      package: {
        catalogId: sampleEntry.id,
        name: sampleEntry.name,
        version: sampleEntry.version,
        snippetCount: 1
      }
    });
  });

  it('does not install when the user declines confirmation', async () => {
    const installFromGit = vi.fn(
      async (): Promise<InstalledSnippetPackage> => ({
        catalogId: sampleEntry.id,
        name: sampleEntry.name,
        version: sampleEntry.version,
        snippetCount: 1
      })
    );

    const result = await resolvePendingSnippetInstallDeepLink(sampleEntry.id, {
      getSnippetCatalog: async () => sampleCatalog,
      listInstalledPackages: async () => [],
      confirmInstall: async () => false,
      installFromGit,
      isCancelled: () => false
    });

    expect(installFromGit).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'declined' });
  });

  it('returns already-installed when the bundle id is present locally', async () => {
    const installed: InstalledSnippetPackage = {
      catalogId: sampleEntry.id,
      name: sampleEntry.name,
      version: sampleEntry.version,
      snippetCount: 1,
      installSource: 'git'
    };

    const result = await resolvePendingSnippetInstallDeepLink(sampleEntry.id, {
      getSnippetCatalog: async () => sampleCatalog,
      listInstalledPackages: async () => [installed],
      confirmInstall: async () => true,
      installFromGit: async () => installed,
      isCancelled: () => false
    });

    expect(result).toEqual({ kind: 'already-installed', package: installed });
  });
});
