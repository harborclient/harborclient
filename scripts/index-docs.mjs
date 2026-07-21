/**
 * Indexes HarborClient site and SDK Markdown docs into an Orama vector database.
 *
 * Reads docs from sibling repos, generates OpenAI embeddings, and writes a
 * serialized index to resources/docsSearchIndex.json for bundling with the app.
 *
 * Usage:
 *   pnpm index-docs
 *   pnpm index-docs --dry-run
 *   pnpm index-docs --out resources/docsSearchIndex.json --model text-embedding-3-small
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, insertMultiple, save } from '@orama/orama';
import OpenAI from 'openai';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const DEFAULT_OUT = path.join(projectRoot, 'resources', 'docsSearchIndex.json');
const DEFAULT_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const ENV_PATH = path.join(scriptDir, '.env');
const CACHE_PATH = path.join(scriptDir, '.cache', 'docs-embeddings.json');

const DOC_SOURCES = [
  {
    source: 'site',
    root: path.resolve(projectRoot, '../site/src'),
    urlBase: 'https://harborclient.com'
  },
  {
    source: 'sdk',
    root: path.resolve(projectRoot, '../sdk/docs'),
    urlBase: 'https://harborclient.github.io/sdk'
  }
];

/**
 * Marketplace plugin/theme catalog source.
 *
 * The marketplace pages (`plugins.md`, `themes.md`) render each listing from
 * this JSON with a Vue component, so the per-plugin README content never exists
 * as Markdown for the doc walker to pick up. We index the catalog directly so
 * plugin usage docs (for example how to import OpenAPI specs) are searchable.
 */
const PLUGIN_CATALOG = {
  source: 'site',
  path: path.resolve(projectRoot, '../site/src/.vitepress/static/plugin_catalog.json'),
  urlBase: 'https://harborclient.com'
};

/**
 * Category slug that marks a catalog entry as a theme rather than a plugin.
 *
 * Themes render on `/themes#<id>` while plugins render on `/plugins#<id>`.
 */
const THEME_CATEGORY = 'themes';

const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  '.vitepress',
  'node_modules',
  'dist',
  'cache',
  'static',
  'theme',
  'scripts',
  'shared',
  'images',
  'nginx',
  'plugins'
]);

const EXCLUDED_FILE_NAMES = new Set(['README.md', 'download.md.in']);

/**
 * Parses CLI flags for the docs indexer.
 *
 * @returns Resolved CLI options.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    out: DEFAULT_OUT,
    model: DEFAULT_MODEL,
    dryRun: false,
    limit: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--out' && args[index + 1]) {
      options.out = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--model' && args[index + 1]) {
      options.model = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--limit' && args[index + 1]) {
      options.limit = Number.parseInt(args[index + 1], 10);
      index += 1;
    }
  }

  return options;
}

/**
 * Loads key/value pairs from a dotenv-style file without external dependencies.
 *
 * @param envPath - Absolute path to the env file.
 * @returns Parsed environment variables.
 */
async function loadEnvFile(envPath) {
  const values = {};
  let raw = '';
  try {
    raw = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return values;
    }
    throw error;
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

/**
 * Resolves the OpenAI API key from env file and process environment.
 *
 * @param envFileValues - Values parsed from scripts/.env.
 * @returns API key string.
 */
function resolveOpenAiApiKey(envFileValues) {
  return (
    envFileValues.OPENAPI_KEY ??
    envFileValues.OPENAI_API_KEY ??
    envFileValues.OPENAI_KEY ??
    process.env.OPENAPI_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENAI_KEY ??
    ''
  );
}

/**
 * Recursively collects Markdown files under a docs root.
 *
 * @param rootDir - Absolute docs root directory.
 * @param currentDir - Directory being walked.
 * @param files - Accumulator for discovered markdown paths.
 */
async function collectMarkdownFiles(rootDir, currentDir = rootDir, files = []) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) {
        continue;
      }
      await collectMarkdownFiles(rootDir, absolutePath, files);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    if (EXCLUDED_FILE_NAMES.has(entry.name)) {
      continue;
    }
    files.push(absolutePath);
  }
  return files;
}

/**
 * Strips YAML frontmatter from a Markdown document when present.
 *
 * @param markdown - Raw file contents.
 * @returns Markdown body without frontmatter.
 */
function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return markdown;
  }
  const closingIndex = markdown.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return markdown;
  }
  return markdown.slice(closingIndex + 5);
}

/**
 * Removes Vue component tags and normalizes whitespace for embedding.
 *
 * @param markdown - Markdown body text.
 * @returns Cleaned markdown suitable for chunking.
 */
function sanitizeMarkdown(markdown) {
  return markdown
    .replace(/<[^>\n/][^>]*\/>/g, '')
    .replace(/<[^>\n/][^>]*>[\s\S]*?<\/[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Removes redundant Markdown from a marketplace catalog description.
 *
 * Mirrors the site's `sanitizeCatalogDescription`: plugin READMEs repeat the
 * plugin name as the first heading and embed screenshot images that the
 * marketplace already renders separately. Stripping them keeps embeddings
 * focused on the actual usage prose.
 *
 * @param markdown - Raw description Markdown from a plugin or theme repository.
 * @returns Description Markdown with the leading heading and inline images removed.
 */
function sanitizeCatalogDescription(markdown) {
  return markdown
    .trimStart()
    .replace(/^#{1,3}\s+[^\n]+\n*/, '')
    .replace(/!\[[^\]]*\]\([^)\s]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts the page title from the first H1 heading or filename.
 *
 * @param markdown - Sanitized markdown body.
 * @param filePath - Absolute markdown file path.
 */
function extractTitle(markdown, filePath) {
  const match = /^#\s+(.+)$/m.exec(markdown);
  if (match) {
    return match[1].trim();
  }
  return path.basename(filePath, '.md');
}

/**
 * Builds the public docs URL for a markdown file.
 *
 * @param sourceConfig - Site or SDK source configuration.
 * @param relativePath - Path relative to the docs root.
 */
function buildDocUrl(sourceConfig, relativePath) {
  const withoutExt = relativePath.replace(/\.md$/u, '');
  if (withoutExt === 'index' || withoutExt.endsWith('/index')) {
    const baseSlug = withoutExt.replace(/\/index$/u, '');
    return baseSlug.length > 0
      ? `${sourceConfig.urlBase}/${baseSlug}/`
      : `${sourceConfig.urlBase}/`;
  }
  return `${sourceConfig.urlBase}/${withoutExt}`;
}

/**
 * Splits a markdown page into heading-based chunks for embedding.
 *
 * @param markdown - Sanitized markdown body.
 * @param metadata - Chunk metadata shared across all sections.
 */
function chunkMarkdown(markdown, metadata) {
  const lines = markdown.split('\n');
  const chunks = [];
  let currentHeading = metadata.title;
  let currentLines = [];

  /**
   * Flushes the current section into a chunk when it has content.
   */
  const flush = () => {
    const content = currentLines.join('\n').trim();
    if (content.length === 0) {
      return;
    }
    chunks.push({
      ...metadata,
      heading: currentHeading,
      content
    });
  };

  for (const line of lines) {
    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }

  flush();

  if (chunks.length === 0 && markdown.trim().length > 0) {
    chunks.push({
      ...metadata,
      heading: metadata.title,
      content: markdown.trim()
    });
  }

  return chunks;
}

/**
 * Reads and chunks all markdown files for one docs source.
 *
 * @param sourceConfig - Site or SDK source configuration.
 */
async function loadSourceChunks(sourceConfig) {
  const rootStat = await stat(sourceConfig.root).catch(() => null);
  if (rootStat == null || !rootStat.isDirectory()) {
    throw new Error(`Docs root not found: ${sourceConfig.root}`);
  }

  const files = await collectMarkdownFiles(sourceConfig.root);
  files.sort((left, right) => left.localeCompare(right));

  const chunks = [];
  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf8');
    const body = sanitizeMarkdown(stripFrontmatter(raw));
    const relativePath = path.relative(sourceConfig.root, filePath).replace(/\\/g, '/');
    const title = extractTitle(body, filePath);
    const url = buildDocUrl(sourceConfig, relativePath);
    const pageChunks = chunkMarkdown(body, {
      source: sourceConfig.source,
      path: relativePath,
      url,
      title
    });

    pageChunks.forEach((chunk, chunkIndex) => {
      chunks.push({
        ...chunk,
        id: `${sourceConfig.source}:${relativePath}#${chunkIndex}`
      });
    });
  }

  return { files: files.length, chunks };
}

/**
 * Reads and chunks every entry in the marketplace plugin/theme catalog.
 *
 * Each listing becomes one or more heading-based chunks that carry the plugin
 * name and summary as context, with a URL that deep-links to the entry on the
 * `/plugins` or `/themes` marketplace page.
 *
 * @param catalogConfig - Catalog source configuration.
 * @returns Discovered entry count and chunk documents (empty when the catalog is missing).
 */
async function loadPluginCatalogChunks(catalogConfig) {
  const catalogStat = await stat(catalogConfig.path).catch(() => null);
  if (catalogStat == null || !catalogStat.isFile()) {
    console.warn(`Plugin catalog not found, skipping: ${catalogConfig.path}`);
    return { entries: 0, chunks: [] };
  }

  const raw = await readFile(catalogConfig.path, 'utf8');
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed?.plugins) ? parsed.plugins : [];

  const chunks = [];
  for (const entry of entries) {
    if (entry == null || typeof entry.id !== 'string') {
      continue;
    }

    const title = typeof entry.name === 'string' && entry.name.trim().length > 0
      ? entry.name.trim()
      : entry.id;
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
    const description =
      typeof entry.description === 'string'
        ? sanitizeCatalogDescription(entry.description)
        : '';

    const isTheme =
      Array.isArray(entry.categories) && entry.categories.includes(THEME_CATEGORY);
    const pageSlug = isTheme ? 'themes' : 'plugins';
    const relativePath = `${pageSlug}#${entry.id}`;
    const context = summary.length > 0 ? `${title} — ${summary}` : title;

    const metadata = {
      source: catalogConfig.source,
      path: relativePath,
      url: `${catalogConfig.urlBase}/${pageSlug}#${entry.id}`,
      title
    };

    const sections =
      description.length > 0
        ? chunkMarkdown(description, metadata)
        : [{ ...metadata, heading: title, content: context }];

    sections.forEach((section, chunkIndex) => {
      // Prepend the plugin name and summary so every section chunk keeps enough
      // context to match name-driven queries after semantic retrieval.
      const content = `${context}\n\n${section.content}`.trim();
      chunks.push({
        ...section,
        content,
        id: `${catalogConfig.source}:${relativePath}#${chunkIndex}`
      });
    });
  }

  return { entries: entries.length, chunks };
}

/**
 * Computes a stable cache key for one chunk embedding.
 *
 * @param model - Embedding model name.
 * @param content - Chunk text sent to the embeddings API.
 */
function embeddingCacheKey(model, content) {
  return createHash('sha256').update(`${model}\n${content}`).digest('hex');
}

/**
 * Loads the embedding cache from disk.
 */
async function loadEmbeddingCache() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed != null ? parsed : {};
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Persists the embedding cache to disk.
 *
 * @param cache - Cache object keyed by sha256 hash.
 */
async function saveEmbeddingCache(cache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

/**
 * Sleeps for the requested number of milliseconds.
 *
 * @param ms - Delay duration.
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Creates embeddings for a batch of chunk texts with retry/backoff.
 *
 * @param client - OpenAI SDK client.
 * @param model - Embedding model name.
 * @param inputs - Chunk texts to embed.
 */
async function createEmbeddingBatch(client, model, inputs) {
  let attempt = 0;
  while (attempt < 5) {
    try {
      const response = await client.embeddings.create({
        model,
        input: inputs
      });
      return response.data.map((row) => row.embedding);
    } catch (error) {
      attempt += 1;
      if (attempt >= 5) {
        throw error;
      }
      const delayMs = 500 * 2 ** (attempt - 1);
      console.warn(`Embedding batch failed (attempt ${attempt}); retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
  return [];
}

/**
 * Embeds all chunks, reusing cached vectors when available.
 *
 * @param chunks - Chunk documents without embeddings.
 * @param apiKey - OpenAI API key.
 * @param model - Embedding model name.
 */
async function embedChunks(chunks, apiKey, model) {
  const cache = await loadEmbeddingCache();
  const client = new OpenAI({ apiKey });
  const documents = [];
  let cacheHits = 0;
  let apiCalls = 0;
  let estimatedTokens = 0;

  const pending = [];
  for (const chunk of chunks) {
    const cacheKey = embeddingCacheKey(model, chunk.content);
    const cached = cache[cacheKey];
    if (Array.isArray(cached) && cached.length === EMBEDDING_DIMENSIONS) {
      documents.push({ ...chunk, embedding: cached });
      cacheHits += 1;
      continue;
    }
    pending.push({ chunk, cacheKey });
  }

  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE);
    const inputs = batch.map((entry) => entry.chunk.content);
    estimatedTokens += inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    const embeddings = await createEmbeddingBatch(client, model, inputs);
    apiCalls += 1;

    batch.forEach((entry, batchIndex) => {
      const embedding = embeddings[batchIndex];
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected embedding size for chunk ${entry.chunk.id}`);
      }
      cache[entry.cacheKey] = embedding;
      documents.push({ ...entry.chunk, embedding });
    });
  }

  await saveEmbeddingCache(cache);

  return {
    documents,
    cacheHits,
    apiCalls,
    estimatedTokens
  };
}

/**
 * Builds and serializes the Orama vector index.
 *
 * @param documents - Chunk documents with embeddings.
 */
function buildOramaIndex(documents) {
  const db = create({
    schema: {
      id: 'string',
      source: 'string',
      path: 'string',
      url: 'string',
      title: 'string',
      heading: 'string',
      content: 'string',
      embedding: `vector[${EMBEDDING_DIMENSIONS}]`
    }
  });

  if (documents.length > 0) {
    insertMultiple(db, documents);
  }

  return save(db);
}

/**
 * Formats a byte count for human-readable CLI output.
 *
 * @param bytes - File size in bytes.
 */
function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Entry point for the docs vector indexer.
 */
async function main() {
  const options = parseArgs();
  const envFileValues = await loadEnvFile(ENV_PATH);
  const apiKey = resolveOpenAiApiKey(envFileValues);

  const allChunks = [];
  let totalFiles = 0;

  for (const sourceConfig of DOC_SOURCES) {
    const { files, chunks } = await loadSourceChunks(sourceConfig);
    totalFiles += files;
    allChunks.push(...chunks);
    console.log(`Loaded ${files} files / ${chunks.length} chunks from ${sourceConfig.source}`);
  }

  const catalogResult = await loadPluginCatalogChunks(PLUGIN_CATALOG);
  allChunks.push(...catalogResult.chunks);
  console.log(
    `Loaded ${catalogResult.entries} entries / ${catalogResult.chunks.length} chunks from plugin catalog`
  );

  const limitedChunks =
    options.limit != null && options.limit > 0
      ? allChunks.slice(0, options.limit)
      : allChunks;

  console.log(`Total: ${totalFiles} files, ${limitedChunks.length} chunks`);

  if (options.dryRun) {
    console.log('Dry run complete. No embeddings or index file written.');
    return;
  }

  if (!apiKey) {
    throw new Error(
      'Missing OpenAI API key. Set OPENAPI_KEY in scripts/.env or OPENAI_API_KEY in the environment.'
    );
  }

  const { documents, cacheHits, apiCalls, estimatedTokens } = await embedChunks(
    limitedChunks,
    apiKey,
    options.model
  );

  const rawIndex = buildOramaIndex(documents);
  await mkdir(path.dirname(options.out), { recursive: true });
  const serialized = `${JSON.stringify(rawIndex)}\n`;
  await writeFile(options.out, serialized, 'utf8');

  const outputStat = await stat(options.out);
  const estimatedCostUsd = (estimatedTokens / 1_000_000) * 0.02;

  console.log(`Embedding cache hits: ${cacheHits}`);
  console.log(`OpenAI embedding API calls: ${apiCalls}`);
  console.log(`Estimated embedding tokens: ~${estimatedTokens}`);
  console.log(`Estimated embedding cost: ~$${estimatedCostUsd.toFixed(4)}`);
  console.log(`Wrote ${options.out} (${formatBytes(outputStat.size)})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
