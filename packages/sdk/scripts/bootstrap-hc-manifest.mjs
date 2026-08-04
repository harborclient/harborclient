/**
 * Bootstraps `hc_sdk_manifest.json` from the four SDK API markdown pages and
 * optional git archaeology for `since` versions (fallback `2.0.0`).
 *
 * Usage:
 *   node packages/sdk/scripts/bootstrap-hc-manifest.mjs
 *   node packages/sdk/scripts/bootstrap-hc-manifest.mjs --write-pages
 *   node packages/sdk/scripts/bootstrap-hc-manifest.mjs --skip-git
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageDir, '../..');
const docsDir = path.join(packageDir, 'docs');
const manifestPath = path.join(docsDir, '.vitepress/hc_sdk_manifest.json');
const DEFAULT_SINCE = '2.0.0';

const API_PAGES = [
  // Historical sources; API prose now lives in docs/introductions + generated docs/api.
];

const GIT_PATHS = [
  'packages/sdk/src/types.ts',
  'apps/gui/src/renderer/src/plugins/createPluginContext.ts',
  'packages/core/src/plugin/types.ts'
];

const args = new Set(process.argv.slice(2));
const writePages = args.has('--write-pages');
const skipGit = args.has('--skip-git');

/**
 * Strips markdown emphasis markers from table cell text.
 *
 * @param {string} value Raw cell contents.
 * @returns {string} Plain text.
 */
const stripCell = (value) =>
  value.replace(/\\\|/g, '|').replace(/^`|`$/g, '').replace(/\*\*/g, '').trim();

/**
 * Converts a full `hc.*` heading into a manifest key without the `hc.` prefix.
 *
 * @param {string} title Heading title such as `hc.ui.registerModal(modal)`.
 * @returns {string} Manifest key such as `ui.registerModal`.
 */
const titleToKey = (title) => {
  const withoutHc = title.replace(/^hc\./, '');
  const paren = withoutHc.indexOf('(');

  return paren === -1 ? withoutHc : withoutHc.slice(0, paren);
};

/**
 * Returns whether a heading is a namespace intro (children follow) vs a leaf API.
 *
 * @param {string} title Heading title.
 * @param {string} _body Section body until the next equal/higher heading (unused).
 * @returns {boolean} True when this should become a manifest entry.
 */
const isLeafApiHeading = (title, _body) => {
  if (/\(/.test(title)) {
    return true;
  }

  // Known property / top-level call docs without parentheses in the title.
  const key = titleToKey(title);
  const propertyKeys = new Set(['pluginId', 'react', 'livePage', 'scripts']);

  return propertyKeys.has(key);
};

/**
 * Parses a markdown parameter/field table into structured rows.
 *
 * @param {string} body Section markdown.
 * @returns {{ name: string; type: string; description: string }[]}
 */
const parseParamTable = (body) => {
  const lines = body.split('\n');
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (/^\|\s*Parameter\s*\|/i.test(line) || /^\|\s*Field\s*\|/i.test(line)) {
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    if (!line.trim().startsWith('|')) {
      break;
    }

    if (/^\|\s*-+/.test(line)) {
      continue;
    }

    // Split on unescaped pipes so types like `A \| B` stay intact.
    const rawCells = [];
    let cell = '';

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === '\\' && line[i + 1] === '|') {
        cell += '|';
        i += 1;
        continue;
      }

      if (ch === '|') {
        rawCells.push(cell);
        cell = '';
        continue;
      }

      cell += ch;
    }

    rawCells.push(cell);

    const cells = rawCells.slice(1, -1).map((value) => stripCell(value).replace(/^`|`$/g, ''));

    if (cells.length < 3) {
      continue;
    }

    rows.push({
      name: cells[0].replace(/^`|`$/g, ''),
      type: cells[1],
      description: cells[2]
    });
  }

  return rows;
};

/**
 * Extracts fenced code examples from a section body.
 *
 * @param {string} body Section markdown.
 * @returns {{ caption?: string; lang?: string; code: string }[]}
 */
const parseExamples = (body) => {
  const examples = [];
  const fencePattern = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;

  while ((match = fencePattern.exec(body)) !== null) {
    const lang = match[1] || 'typescript';
    const code = match[2].replace(/\n$/, '');

    // Skip bare JSON manifest snippets that are not call examples when they
    // are the only fence after a long narrative — still keep typescript/tsx/js.
    if (lang === 'json' && !/hc\./.test(code)) {
      continue;
    }

    examples.push({ lang, code });
  }

  return examples;
};

/**
 * Pulls Signature / Manifest / permission / description from a section body.
 *
 * @param {string} body Section markdown.
 * @returns {{
 *   signature: string;
 *   manifest?: string;
 *   permission?: string;
 *   description: string;
 *   params?: object[];
 *   fields?: object[];
 *   examples?: object[];
 * }}
 */
const parseSectionBody = (body) => {
  const signatureMatch = body.match(/\*\*Signature:\*\*\s*`([^`]+)`/);
  const manifestMatch = body.match(/\*\*Manifest:\*\*\s*`([^`]+)`([^\n]*)/);
  const permissionMatch = body.match(/Requires the `([^`]+)` permission/);

  let working = body;
  working = working.replace(/\*\*Signature:\*\*\s*`[^`]+`\s*/g, '');
  working = working.replace(/\*\*Manifest:\*\*\s*`[^`]+`[^\n]*\n*/g, '');

  const tableRows = parseParamTable(body);
  // Drop the table from description text.
  working = working.replace(/\|\s*(?:Parameter|Field)\s*\|[\s\S]*?(?=\n\n(?!\|)|$)/, '\n');

  const examples = parseExamples(working);
  // Drop fences from description.
  working = working.replace(/```[a-zA-Z0-9_-]*\n[\s\S]*?```/g, '');

  const description = working.replace(/\n{3,}/g, '\n\n').trim();

  /** @type {Record<string, unknown>} */
  const entry = {
    signature: signatureMatch?.[1]?.replace(/\\\|/g, '|') ?? '',
    description
  };

  if (manifestMatch) {
    entry.manifest = manifestMatch[1];
  }

  if (permissionMatch) {
    entry.permission = permissionMatch[1];
  }

  if (tableRows.length > 0) {
    // Contribution registrars document object fields under "Parameter".
    const looksLikeContributionFields = tableRows.some((row) =>
      ['id', 'title', 'Component', 'command', 'icon', 'order'].includes(row.name)
    );

    if (
      looksLikeContributionFields &&
      /\b(section|panel|tab|modal|item|action|block|theme|config)\b/i.test(
        signatureMatch?.[1] ?? ''
      )
    ) {
      entry.fields = tableRows;
    } else if (
      looksLikeContributionFields &&
      /Contribution|ThemeContribution|PluginMcpServerConfig/.test(signatureMatch?.[1] ?? '')
    ) {
      entry.fields = tableRows;
    } else {
      entry.params = tableRows;
    }

    // Prefer fields for register* contribution tables.
    if (
      /register[A-Z]|themes\.register|mcp\.register/.test(signatureMatch?.[1] ?? '') ||
      /Contribution/.test(signatureMatch?.[1] ?? '')
    ) {
      entry.fields = tableRows;
      delete entry.params;
    }
  }

  if (examples.length > 0) {
    entry.examples = examples;
  }

  return entry;
};

/**
 * Parses one API markdown file into leaf sections.
 *
 * @param {string} markdown File contents.
 * @returns {{ title: string; level: number; body: string; key: string }[]}
 */
const parseLeafSections = (markdown) => {
  const lines = markdown.split('\n');
  /** @type {{ title: string; level: number; start: number; isHc: boolean }[]} */
  const headings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(#{2,4})\s+(.+)$/.exec(lines[i]);

    if (!match) {
      continue;
    }

    const title = match[2].trim();

    headings.push({
      title,
      level: match[1].length,
      start: i,
      isHc: title.startsWith('hc.')
    });
  }

  /** @type {{ title: string; level: number; body: string; key: string }[]} */
  const sections = [];

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];

    if (!current.isHc) {
      continue;
    }

    // End at the next heading of the same or higher level so nested narrative
    // under a method (### / ####) stays in the body, but sibling sections do not.
    let end = lines.length;

    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= current.level) {
        end = headings[j].start;
        break;
      }
    }

    const body = lines.slice(current.start + 1, end).join('\n');

    if (!isLeafApiHeading(current.title, body)) {
      continue;
    }

    sections.push({
      title: current.title,
      level: /** @type {2|3|4} */ (current.level),
      body,
      key: titleToKey(current.title)
    });
  }

  return sections;
};

/**
 * Resolves the first HarborClient app tag that contains a commit.
 *
 * @param {string} commitSha Commit hash.
 * @returns {string | null} Semver without `v`, or null.
 */
const firstAppVersionForCommit = (commitSha) => {
  try {
    const tags = execFileSync('git', ['tag', '--contains', commitSha, '--list', 'v2.*'], {
      cwd: repoRoot,
      encoding: 'utf8'
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((a, b) => {
        const pa = a.replace(/^v/, '').split('.').map(Number);
        const pb = b.replace(/^v/, '').split('.').map(Number);

        for (let i = 0; i < 3; i += 1) {
          const diff = (pa[i] ?? 0) - (pb[i] ?? 0);

          if (diff !== 0) {
            return diff;
          }
        }

        return 0;
      });

    if (tags.length === 0) {
      return null;
    }

    return tags[0].replace(/^v/, '');
  } catch {
    return null;
  }
};

/**
 * Finds the earliest commit that introduced a method name, then maps to a tag.
 *
 * @param {string} methodName Bare method identifier (for example `registerModal`).
 * @returns {string} Semver `since` value.
 */
const resolveSince = (methodName) => {
  if (skipGit) {
    return DEFAULT_SINCE;
  }

  /** @type {string[]} */
  const commits = [];

  for (const filePath of GIT_PATHS) {
    try {
      const out = execFileSync('git', ['log', '-S', methodName, '--format=%H', '--', filePath], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (out.length > 0) {
        commits.push(out[out.length - 1]);
      }
    } catch {
      // Ignore missing path / empty history.
    }
  }

  if (commits.length === 0) {
    return DEFAULT_SINCE;
  }

  // Prefer the chronologically earliest among candidates.
  let bestCommit = commits[0];
  let bestTime = Number.POSITIVE_INFINITY;

  for (const commit of commits) {
    try {
      const ts = Number(
        execFileSync('git', ['log', '-1', '--format=%ct', commit], {
          cwd: repoRoot,
          encoding: 'utf8'
        }).trim()
      );

      if (ts < bestTime) {
        bestTime = ts;
        bestCommit = commit;
      }
    } catch {
      // Keep prior best.
    }
  }

  const version = firstAppVersionForCommit(bestCommit);

  // Bulk-import cliff (~2.6.x) is treated as unknown baseline.
  if (!version || version.startsWith('2.6.') || version < '2.7.0') {
    return DEFAULT_SINCE;
  }

  return version;
};

/**
 * Merges two scraped entries for the same key, preferring richer content.
 *
 * @param {Record<string, unknown> | undefined} existing Prior entry.
 * @param {Record<string, unknown>} next Newly scraped entry.
 * @returns {Record<string, unknown>}
 */
const mergeEntries = (existing, next) => {
  if (!existing) {
    return next;
  }

  const pickLonger = (a, b) => (String(b ?? '').length > String(a ?? '').length ? b : a);

  return {
    ...existing,
    ...next,
    title: existing.title,
    level: existing.level,
    since: existing.since,
    signature: pickLonger(existing.signature, next.signature),
    description: pickLonger(existing.description, next.description),
    manifest: next.manifest ?? existing.manifest,
    permission: next.permission ?? existing.permission,
    params:
      (next.params?.length ?? 0) >= (existing.params?.length ?? 0)
        ? (next.params ?? existing.params)
        : existing.params,
    fields:
      (next.fields?.length ?? 0) >= (existing.fields?.length ?? 0)
        ? (next.fields ?? existing.fields)
        : existing.fields,
    examples:
      (next.examples?.length ?? 0) >= (existing.examples?.length ?? 0)
        ? (next.examples ?? existing.examples)
        : existing.examples
  };
};

/**
 * Replaces leaf `hc.*` sections in a markdown page with `<HcMethod />` tags.
 *
 * @param {string} markdown Original page markdown.
 * @param {Set<string>} keys Manifest keys that were extracted from this page.
 * @returns {string} Migrated markdown.
 */
const migratePageMarkdown = (markdown, keys) => {
  const lines = markdown.split('\n');
  /** @type {string[]} */
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const match = /^(#{2,4})\s+(hc\..+)$/.exec(lines[i]);

    if (!match) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const title = match[2].trim();
    const key = titleToKey(title);
    let j = i + 1;

    while (j < lines.length && !/^#{2,4}\s+/.test(lines[j])) {
      j += 1;
    }

    const body = lines.slice(i + 1, j).join('\n');

    if (keys.has(key) && isLeafApiHeading(title, body)) {
      const level = match[1].length;
      // Emit level override when the page level may differ from the stored default.
      out.push(`<HcMethod name="${key}" :level="${level}" />`);
      out.push('');
      i = j;
      continue;
    }

    out.push(lines[i]);
    i += 1;
  }

  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
};

/**
 * Bootstraps the manifest (and optionally rewrites API pages).
 */
const main = async () => {
  /** @type {Record<string, Record<string, unknown>>} */
  const manifest = {};
  /** @type {Map<string, Set<string>>} */
  const pageKeys = new Map();

  for (const page of API_PAGES) {
    const pagePath = path.join(docsDir, page);
    const markdown = await readFile(pagePath, 'utf8');
    const sections = parseLeafSections(markdown);
    const keys = new Set();

    for (const section of sections) {
      keys.add(section.key);
      const parsed = parseSectionBody(section.body);
      const methodName = section.key.includes('.')
        ? section.key.slice(section.key.lastIndexOf('.') + 1)
        : section.key;

      const entry = {
        title: section.title,
        level: section.level,
        since: resolveSince(methodName),
        ...parsed
      };

      // Drop empty optional arrays / strings.
      if (!entry.signature) {
        delete entry.signature;
        entry.signature = '';
      }

      if (!entry.permission) {
        delete entry.permission;
      }

      if (!entry.manifest) {
        delete entry.manifest;
      }

      if (!entry.params?.length) {
        delete entry.params;
      }

      if (!entry.fields?.length) {
        delete entry.fields;
      }

      if (!entry.examples?.length) {
        delete entry.examples;
      }

      manifest[section.key] = mergeEntries(manifest[section.key], entry);
    }

    pageKeys.set(page, keys);
    console.log(`${page}: ${keys.size} leaf APIs`);
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });

  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, manifest[key]])
  );

  await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(sorted).length} entries → ${manifestPath}`);

  if (writePages) {
    for (const page of API_PAGES) {
      const pagePath = path.join(docsDir, page);
      const markdown = await readFile(pagePath, 'utf8');
      const migrated = migratePageMarkdown(markdown, pageKeys.get(page) ?? new Set());
      await writeFile(pagePath, migrated, 'utf8');
      console.log(`Migrated ${page}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
