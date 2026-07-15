import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create, insertMultiple, save } from '@orama/orama';
import { DOCS_EMBEDDING_DIMENSIONS } from './docsSearch';

let appRoot = '';
let tempIndexPath = '';

const indexedEmbedding = Array.from({ length: DOCS_EMBEDDING_DIMENSIONS }, (_, index) =>
  index === 0 ? 1 : 0
);

const sdkEmbedding = Array.from({ length: DOCS_EMBEDDING_DIMENSIONS }, (_, index) =>
  index === 0 ? 0.95 : 0
);

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => appRoot
  }
}));

vi.mock('#/main/settings/aiSettings', () => ({
  getAiSettings: vi.fn(() => ({
    openaiApiKey: 'test-openai-key',
    claudeApiKey: '',
    geminiApiKey: ''
  }))
}));

vi.mock('openai', () => ({
  default: class OpenAIMock {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [
          {
            embedding: Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0))
          }
        ]
      })
    };
  }
}));

/**
 * Builds a tiny serialized docs index for tests.
 *
 * @returns Serialized Orama raw data.
 */
function buildSampleDocsIndex(): ReturnType<typeof save> {
  const db = create({
    schema: {
      id: 'string',
      source: 'string',
      path: 'string',
      url: 'string',
      title: 'string',
      heading: 'string',
      content: 'string',
      embedding: `vector[${DOCS_EMBEDDING_DIMENSIONS}]`
    }
  });

  insertMultiple(db, [
    {
      id: 'site:scripting.md#0',
      source: 'site',
      path: 'scripting.md',
      url: 'https://harborclient.com/scripting',
      title: 'Scripting',
      heading: 'Pre-request scripts',
      content: 'Pre-request scripts run before each HTTP request is sent.',
      embedding: indexedEmbedding
    },
    {
      id: 'sdk:usage.md#0',
      source: 'sdk',
      path: 'usage.md',
      url: 'https://harborclient.github.io/sdk/usage',
      title: 'Quick start',
      heading: 'Renderer entry',
      content: 'Plugins render UI through the HarborClient SDK renderer API.',
      embedding: sdkEmbedding
    }
  ]);

  return save(db);
}

/**
 * Writes a temporary docs search index file for tests.
 *
 * @returns Absolute path to the serialized index file.
 */
function createTempDocsIndex(): string {
  const root = mkdtempSync(join(tmpdir(), 'harborclient-docs-search-'));
  const resourcesDir = join(root, 'resources');
  mkdirSync(resourcesDir, { recursive: true });
  const indexPath = join(resourcesDir, 'docsSearchIndex.json');
  writeFileSync(indexPath, `${JSON.stringify(buildSampleDocsIndex())}\n`, 'utf8');
  appRoot = root;
  return indexPath;
}

describe('searchDocs', () => {
  beforeEach(async () => {
    vi.resetModules();
    tempIndexPath = createTempDocsIndex();
    const docsSearch = await import('#/main/docs/docsSearch');
    docsSearch.resetDocsSearchCache();
    vi.spyOn(docsSearch, 'getDocsSearchIndexPaths').mockReturnValue([tempIndexPath]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (appRoot) {
      rmSync(appRoot, { recursive: true, force: true });
      appRoot = '';
    }
    tempIndexPath = '';
  });

  it('returns mapped documentation hits for a vector query', async () => {
    const { searchDocs } = await import('#/main/docs/docsSearch');
    const hits = await searchDocs({ query: 'pre-request scripts' });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({
      title: 'Scripting',
      heading: 'Pre-request scripts',
      source: 'site',
      url: 'https://harborclient.com/scripting'
    });
    expect(hits[0]?.snippet).toContain('Pre-request scripts run');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it('filters results by documentation source', async () => {
    const { searchDocs } = await import('#/main/docs/docsSearch');
    const hits = await searchDocs({ query: 'plugin renderer', source: 'sdk', limit: 3 });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.source).toBe('sdk');
    expect(hits[0]?.title).toBe('Quick start');
  });

  it('throws when the OpenAI API key is not configured', async () => {
    const { getAiSettings } = await import('#/main/settings/aiSettings');
    vi.mocked(getAiSettings).mockReturnValue({
      openaiApiKey: '',
      claudeApiKey: '',
      geminiApiKey: ''
    });

    const { searchDocs, resetDocsSearchCache } = await import('#/main/docs/docsSearch');
    resetDocsSearchCache();

    await expect(searchDocs({ query: 'scripting' })).rejects.toThrow(
      'OpenAI API key is not configured'
    );
  });

  it('throws when query is empty', async () => {
    const { searchDocs } = await import('#/main/docs/docsSearch');
    await expect(searchDocs({ query: '   ' })).rejects.toThrow('query is required');
  });
});
