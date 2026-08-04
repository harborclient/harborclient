/**
 * Generates per-namespace API docs pages and the book-style API index from
 * `hc_namespaces.json`, `hc_sdk_manifest.json`, and optional introduction fragments.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { namespaceOfKey, oneSentence } from './docs-hc-namespaces.mjs';
import { toAnchor } from './docs-slugger.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const docsDir = path.join(repoDir, 'docs');
const apiDir = path.join(docsDir, 'api');
const hcManifestPath = path.join(docsDir, '.vitepress/hc_sdk_manifest.json');
const hcNamespacesPath = path.join(docsDir, '.vitepress/hc_namespaces.json');

/**
 * @typedef {{ namespace: string; title: string; introduction?: string }} HcNamespaceEntry
 */

/**
 * Loads and validates `hc_namespaces.json`.
 *
 * @returns {Promise<HcNamespaceEntry[]>}
 */
const loadNamespaces = async () => {
  /** @type {HcNamespaceEntry[]} */
  const namespaces = JSON.parse(await readFile(hcNamespacesPath, 'utf8'));

  if (!Array.isArray(namespaces) || namespaces.length === 0) {
    throw new Error('hc_namespaces.json must be a non-empty array');
  }

  const seen = new Set();

  for (const entry of namespaces) {
    if (typeof entry?.namespace !== 'string' || !entry.namespace) {
      throw new Error('hc_namespaces.json entry missing namespace');
    }

    if (typeof entry?.title !== 'string' || !entry.title) {
      throw new Error(`hc_namespaces.json: ${entry.namespace} missing title`);
    }

    if (seen.has(entry.namespace)) {
      throw new Error(`hc_namespaces.json: duplicate namespace ${entry.namespace}`);
    }

    seen.add(entry.namespace);
  }

  return namespaces;
};

/**
 * Loads `hc_sdk_manifest.json`.
 *
 * @returns {Promise<Record<string, { title: string; description?: string; level?: number }>>}
 */
const loadManifest = async () => JSON.parse(await readFile(hcManifestPath, 'utf8'));

/**
 * Reads an introduction fragment relative to docs/, or empty string when absent.
 *
 * @param {string | undefined} relativePath Path relative to docs/.
 * @returns {Promise<string>}
 */
const readIntroduction = async (relativePath) => {
  if (!relativePath) {
    return '';
  }

  const absolute = path.join(docsDir, relativePath);
  const markdown = await readFile(absolute, 'utf8');

  return markdown.trim();
};

/**
 * First prose paragraph of an intro (for the API landing page).
 *
 * @param {string} markdown Intro markdown.
 * @returns {string}
 */
const firstParagraph = (markdown) => {
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    if (block.startsWith('#')) {
      continue;
    }

    if (/^[-*]\s/.test(block) || /^\d+\.\s/.test(block)) {
      continue;
    }

    return block
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
};

/**
 * Builds markdown for one namespace API page.
 *
 * @param {HcNamespaceEntry} entry Namespace registry entry.
 * @param {string[]} methodKeys Sorted manifest keys for this namespace.
 * @param {string} introduction Intro fragment body.
 * @returns {string}
 */
const buildNamespacePage = (entry, methodKeys, introduction) => {
  const parts = [`# ${entry.title}`, ''];

  if (introduction) {
    parts.push(introduction, '');
  }

  for (const key of methodKeys) {
    parts.push(`<HcMethod name="${key}" :level="2" />`, '');
  }

  return `${parts.join('\n').trim()}\n`;
};

/**
 * Builds the API group landing page.
 *
 * @param {HcNamespaceEntry[]} namespaces Ordered namespaces.
 * @param {Map<string, string>} introByNamespace Intro bodies.
 * @returns {string}
 */
const buildApiIndexLanding = (namespaces, introByNamespace) => {
  const lines = [
    '# API',
    '',
    'Plugin APIs are grouped by `hc` namespace. Each page starts with conceptual notes (when present) and then the full method reference.',
    ''
  ];

  for (const entry of namespaces) {
    let blurb = firstParagraph(introByNamespace.get(entry.namespace) ?? '');
    blurb = blurb.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    if (blurb.length > 120) {
      blurb = `${blurb.slice(0, 117).trim()}…`;
    }

    const suffix = blurb ? ` — ${blurb}` : '';
    lines.push(`- [${entry.title}](/api/${entry.namespace})${suffix}`);
  }

  lines.push('');

  return `${lines.join('\n')}\n`;
};

/**
 * Builds the book-style A–Z method index.
 *
 * @param {Record<string, { title: string; description?: string }>} manifest Method manifest.
 * @returns {string}
 */
const buildBookIndex = (manifest) => {
  const entries = Object.entries(manifest)
    .map(([key, entry]) => {
      const ns = namespaceOfKey(key);

      return {
        key,
        title: entry.title,
        ns,
        anchor: toAnchor(entry.title),
        blurb: oneSentence(entry.description ?? '')
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));

  const lines = [
    '# Index',
    '',
    'Alphabetical index of public `hc.*` APIs. Each entry links to the full reference on its namespace page.',
    ''
  ];

  let currentLetter = '';

  for (const entry of entries) {
    const letter = entry.title.replace(/^hc\./i, '').charAt(0).toUpperCase();

    if (letter !== currentLetter) {
      // Blank line before each letter heading (except the first) so Prettier stays clean.
      if (currentLetter !== '') {
        lines.push('');
      }

      currentLetter = letter;
      lines.push(`## ${currentLetter}`, '');
    }

    const safeBlurb = entry.blurb
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    lines.push(`- [\`${entry.title}\`](/api/${entry.ns}#${entry.anchor}) — ${safeBlurb}`);
  }

  // Single trailing newline — an extra blank line fails Prettier --check.
  return `${lines.join('\n')}\n`;
};

/**
 * Clears previously generated namespace markdown under docs/api/.
 *
 * @returns {Promise<void>}
 */
const clearGeneratedApiPages = async () => {
  await mkdir(apiDir, { recursive: true });

  const entries = await readdir(apiDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
      await rm(path.join(apiDir, entry.name));
    }
  }
};

const namespaces = await loadNamespaces();
const manifest = await loadManifest();

/** @type {Map<string, string[]>} */
const keysByNamespace = new Map();

for (const key of Object.keys(manifest)) {
  const ns = namespaceOfKey(key);
  const list = keysByNamespace.get(ns) ?? [];
  list.push(key);
  keysByNamespace.set(ns, list);
}

for (const [, keys] of keysByNamespace) {
  keys.sort((a, b) => a.localeCompare(b, 'en'));
}

const registered = new Set(namespaces.map((entry) => entry.namespace));
const missing = [...keysByNamespace.keys()].filter((ns) => !registered.has(ns)).sort();
const empty = namespaces.filter((entry) => !keysByNamespace.has(entry.namespace));

if (missing.length > 0) {
  throw new Error(
    `hc_namespaces.json missing namespaces present in hc_sdk_manifest.json: ${missing.join(', ')}`
  );
}

if (empty.length > 0) {
  throw new Error(
    `hc_namespaces.json has namespaces with no hc_sdk_manifest.json keys: ${empty
      .map((entry) => entry.namespace)
      .join(', ')}`
  );
}

await clearGeneratedApiPages();

/** @type {Map<string, string>} */
const introByNamespace = new Map();

for (const entry of namespaces) {
  const introduction = await readIntroduction(entry.introduction);
  introByNamespace.set(entry.namespace, introduction);
  const methodKeys = keysByNamespace.get(entry.namespace) ?? [];
  const page = buildNamespacePage(entry, methodKeys, introduction);
  await writeFile(path.join(apiDir, `${entry.namespace}.md`), page);
}

const notExtensiblePath = path.join(docsDir, 'introductions/_not-extensible.md');
let notExtensible = '';

try {
  notExtensible = (await readFile(notExtensiblePath, 'utf8')).trim();
} catch {
  notExtensible = '';
}

let landing = buildApiIndexLanding(namespaces, introByNamespace);

if (notExtensible) {
  landing = `${landing.trimEnd()}\n\n## Not extensible\n\n${notExtensible}\n`;
}

await writeFile(path.join(apiDir, 'index.md'), landing);
await writeFile(path.join(docsDir, 'api-index.md'), buildBookIndex(manifest));

console.log(
  `Generated ${namespaces.length} API namespace pages, docs/api/index.md, and docs/api-index.md`
);
