import { afterEach, describe, expect, it, vi } from 'vitest';

const manifest = {
  id: 'com.example.demo',
  name: 'Demo Plugin',
  version: '1.0.0',
  author: 'Example Inc.',
  description: 'README.md',
  engines: { harborclient: '>=1.8.0' },
  renderer: 'dist/renderer.js',
  permissions: ['ui']
};

const readme = '# Demo Plugin\n\nA sample plugin.';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPluginPreviewFromGit', () => {
  it('fetches manifest, description, and screenshot from GitHub', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/manifest.json')) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      if (url.endsWith('/README.md')) {
        return new Response(readme, { status: 200 });
      }
      if (url.endsWith('/screenshot.png')) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    await expect(
      fetchPluginPreviewFromGit('https://github.com/example/demo-plugin', 'main')
    ).resolves.toEqual({
      manifest,
      descriptionMarkdown: readme,
      screenshotSrcs: [expect.stringMatching(/^data:image\/png;base64,/)]
    });
  });

  it('resolves every manifest screenshot entry', async () => {
    const manifestWithScreenshots = {
      ...manifest,
      screenshots: ['assets/one.png', 'assets/two.png']
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/manifest.json')) {
        return new Response(JSON.stringify(manifestWithScreenshots), { status: 200 });
      }
      if (url.endsWith('/assets/one.png')) {
        return new Response(new Uint8Array([1]), { status: 200 });
      }
      if (url.endsWith('/assets/two.png')) {
        return new Response(new Uint8Array([2]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    const preview = await fetchPluginPreviewFromGit('https://github.com/example/demo-plugin');
    expect(preview.screenshotSrcs).toHaveLength(2);
    expect(preview.screenshotSrcs?.[0]).toMatch(/^data:image\/png;base64,/);
    expect(preview.screenshotSrcs?.[1]).toMatch(/^data:image\/png;base64,/);
  });

  it('passes through absolute screenshot URLs from the manifest', async () => {
    const absoluteUrl = 'https://example.com/screenshot-a.png';
    const manifestWithAbsoluteUrl = {
      ...manifest,
      screenshots: [absoluteUrl, 'assets/local.png']
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/manifest.json')) {
        return new Response(JSON.stringify(manifestWithAbsoluteUrl), { status: 200 });
      }
      if (url.endsWith('/assets/local.png')) {
        return new Response(new Uint8Array([1]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    const preview = await fetchPluginPreviewFromGit('https://github.com/example/demo-plugin');
    expect(preview.screenshotSrcs).toEqual([
      absoluteUrl,
      expect.stringMatching(/^data:image\/png;base64,/)
    ]);
  });

  it('throws for non-GitHub repository URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 }))
    );

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    await expect(
      fetchPluginPreviewFromGit('https://gitlab.com/example/demo-plugin')
    ).rejects.toThrow(/github repositories/i);
  });

  it('throws when manifest.json cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 }))
    );

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    await expect(
      fetchPluginPreviewFromGit('https://github.com/example/demo-plugin')
    ).rejects.toThrow(/manifest\.json/i);
  });

  it('returns preview without description when README fetch fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/manifest.json')) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchPluginPreviewFromGit } = await import('#/main/plugins/gitPluginPreview');
    await expect(
      fetchPluginPreviewFromGit('https://github.com/example/demo-plugin')
    ).resolves.toEqual({
      manifest,
      descriptionMarkdown: undefined,
      screenshotSrcs: undefined
    });
  });
});
