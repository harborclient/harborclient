import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { namespaceOfKey } from './docs-hc-namespaces.mjs';
import {
  canonicalPageSlugs,
  docsNav,
  groupOverviewSlugs,
  syncedPages
} from './docs-nav.config.mjs';
import { getHeadings, listHcMethodNames, toAnchor } from './docs-slugger.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const docsDir = path.join(repoDir, 'docs');
const hcManifestPath = path.join(docsDir, '.vitepress/hc_sdk_manifest.json');
const hcNamespacesPath = path.join(docsDir, '.vitepress/hc_namespaces.json');

/**
 * Loads `hc_namespaces.json`.
 *
 * @returns {Promise<Array<{ namespace: string; title: string; introduction?: string }>>}
 */
const loadHcNamespaces = async () => JSON.parse(await readFile(hcNamespacesPath, 'utf8'));

/**
 * Loads and validates `hc_sdk_manifest.json` entries used by `<HcMethod>`.
 *
 * @returns {Promise<Record<string, { title: string; level: number; since: string; description: string }>>}
 */
const loadHcManifest = async () => {
  const raw = await readFile(hcManifestPath, 'utf8');
  /** @type {Record<string, Record<string, unknown>>} */
  const manifest = JSON.parse(raw);
  const errors = [];

  for (const [key, entry] of Object.entries(manifest)) {
    if (typeof entry?.title !== 'string' || !entry.title) {
      errors.push(`${key}: missing title`);
    }

    if (![2, 3, 4].includes(entry?.level)) {
      errors.push(`${key}: level must be 2, 3, or 4`);
    }

    if (typeof entry?.since !== 'string' || !/^\d+\.\d+\.\d+$/.test(entry.since)) {
      errors.push(`${key}: since must be a semver string (got ${JSON.stringify(entry?.since)})`);
    }

    if (typeof entry?.description !== 'string' || !entry.description.trim()) {
      errors.push(`${key}: missing description`);
    }

    if (typeof entry?.signature !== 'string') {
      errors.push(`${key}: signature must be a string (may be empty for property docs)`);
    }
  }

  if (errors.length > 0) {
    console.error('hc_sdk_manifest.json validation errors:');
    console.error(errors);
    process.exit(1);
  }

  return /** @type {Record<string, { title: string; level: number; since: string; description: string }>} */ (
    manifest
  );
};

const INTERNAL_LINK_PATTERN = /\]\((\/[^)#?]+)(#[^)#?]+)?\)/g;

/**
 * Verifies heading slug parity for a markdown document.
 *
 * @param {string} label Document label for error output.
 * @param {{ level: number; title: string; anchor: string }[]} headings Heading metadata.
 */
const verifyHeadingSlugs = (label, headings) => {
  const mismatches = [];

  for (const heading of headings) {
    const baseAnchor = toAnchor(heading.title);

    if (heading.anchor !== baseAnchor && !heading.anchor.startsWith(`${baseAnchor}-`)) {
      mismatches.push({
        title: heading.title,
        anchor: heading.anchor,
        baseAnchor
      });
    }
  }

  if (mismatches.length > 0) {
    console.error(`Unexpected heading anchor mismatches in ${label}:`);
    console.error(mismatches);
    process.exit(1);
  }
};

/**
 * Returns whether a path exists on disk.
 *
 * @param {string} filePath Absolute file path.
 * @returns {Promise<boolean>}
 */
const pathExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Loads canonical markdown pages referenced by the nav manifest.
 *
 * @param {Record<string, { title: string; level: number }>} hcManifest HC method manifest.
 * @returns {Promise<Map<string, { label: string; markdown: string; headings: ReturnType<typeof getHeadings> }>>}
 */
const loadCanonicalPages = async (hcManifest) => {
  /** @type {Map<string, { label: string; markdown: string; headings: ReturnType<typeof getHeadings> }>} */
  const pages = new Map();

  const indexPath = path.join(docsDir, 'index.md');
  const indexMarkdown = await readFile(indexPath, 'utf8');
  pages.set('/', {
    label: 'docs/index.md',
    markdown: indexMarkdown,
    headings: getHeadings(indexMarkdown, hcManifest)
  });

  for (const slug of canonicalPageSlugs) {
    const pagePath = path.join(docsDir, `${slug}.md`);
    const markdown = await readFile(pagePath, 'utf8');
    pages.set(`/${slug}`, {
      label: `docs/${slug}.md`,
      markdown,
      headings: getHeadings(markdown, hcManifest)
    });
  }

  for (const slug of groupOverviewSlugs) {
    const pagePath = path.join(docsDir, slug, 'index.md');
    const markdown = await readFile(pagePath, 'utf8');
    pages.set(`/${slug}/`, {
      label: `docs/${slug}/index.md`,
      markdown,
      headings: getHeadings(markdown, hcManifest)
    });
    pages.set(`/${slug}`, pages.get(`/${slug}/`));
  }

  return pages;
};

/**
 * Builds the set of routable docs paths and their heading anchors.
 *
 * @param {Map<string, { label: string; markdown: string; headings: ReturnType<typeof getHeadings> }>} canonicalPages Canonical page metadata.
 * @param {Record<string, { title: string; level: number }>} hcManifest HC method manifest.
 * @returns {Promise<Map<string, Set<string>>>}
 */
const buildRouteAnchorMap = async (canonicalPages, hcManifest) => {
  /** @type {Map<string, Set<string>>} */
  const routeAnchors = new Map();

  for (const [route, page] of canonicalPages.entries()) {
    routeAnchors.set(route, new Set(page.headings.map((heading) => heading.anchor)));
  }

  for (const entry of docsNav) {
    if (entry.kind === 'group') {
      for (const page of entry.pages) {
        const pagePath = path.join(docsDir, entry.slug, `${page.name}.md`);

        if (await pathExists(pagePath)) {
          const markdown = await readFile(pagePath, 'utf8');
          routeAnchors.set(
            `/${entry.slug}/${page.name}`,
            new Set(getHeadings(markdown, hcManifest).map((heading) => heading.anchor))
          );
        }
      }
      continue;
    }

    if (entry.kind === 'api') {
      const namespaces = await loadHcNamespaces();

      for (const ns of namespaces) {
        const pagePath = path.join(docsDir, 'api', `${ns.namespace}.md`);

        if (await pathExists(pagePath)) {
          const markdown = await readFile(pagePath, 'utf8');
          routeAnchors.set(
            `/api/${ns.namespace}`,
            new Set(getHeadings(markdown, hcManifest).map((heading) => heading.anchor))
          );
        }
      }
    }
  }

  for (const page of syncedPages) {
    const targetDir = page.targetDir ?? 'docs';
    const route =
      targetDir === 'docs' ? `/${page.name}` : `/${targetDir.replace(/^docs\//, '')}/${page.name}`;

    if (await pathExists(path.join(repoDir, targetDir, `${page.name}.md`))) {
      routeAnchors.set(route, new Set());
    }
  }

  return routeAnchors;
};

/**
 * Verifies every `<HcMethod>` tag resolves and required entry fields are present.
 *
 * @param {Map<string, { label: string; markdown: string }>} canonicalPages Canonical pages.
 * @param {Record<string, unknown>} hcManifest Loaded manifest.
 * @param {Array<{ namespace: string }>} namespaces Namespace registry.
 */
const verifyHcMethodTags = async (canonicalPages, hcManifest, namespaces) => {
  const errors = [];
  /** @type {Set<string>} */
  const documented = new Set();

  for (const page of canonicalPages.values()) {
    for (const name of listHcMethodNames(page.markdown)) {
      if (!hcManifest[name]) {
        errors.push(`${page.label}: <HcMethod name="${name}" /> missing from hc_sdk_manifest.json`);
      }

      documented.add(name);
    }
  }

  for (const ns of namespaces) {
    const pagePath = path.join(docsDir, 'api', `${ns.namespace}.md`);
    const label = `docs/api/${ns.namespace}.md`;

    if (!(await pathExists(pagePath))) {
      errors.push(`${label}: missing generated API page`);
      continue;
    }

    const markdown = await readFile(pagePath, 'utf8');

    for (const name of listHcMethodNames(markdown)) {
      if (!hcManifest[name]) {
        errors.push(`${label}: <HcMethod name="${name}" /> missing from hc_sdk_manifest.json`);
      }

      if (namespaceOfKey(name) !== ns.namespace) {
        errors.push(
          `${label}: <HcMethod name="${name}" /> does not belong to namespace ${ns.namespace}`
        );
      }

      documented.add(name);
    }
  }

  for (const key of Object.keys(hcManifest)) {
    if (!documented.has(key)) {
      errors.push(`hc_sdk_manifest.json: ${key} is not documented on any generated API page`);
    }
  }

  if (errors.length > 0) {
    console.error('HcMethod reference errors:');
    console.error(errors);
    process.exit(1);
  }
};

/**
 * Verifies namespace registry parity with the method manifest and intro files.
 *
 * @param {Record<string, unknown>} hcManifest Method manifest.
 * @param {Array<{ namespace: string; title: string; introduction?: string }>} namespaces Namespace registry.
 */
const verifyNamespaceRegistry = async (hcManifest, namespaces) => {
  const errors = [];
  const registered = new Set();

  for (const entry of namespaces) {
    if (registered.has(entry.namespace)) {
      errors.push(`hc_namespaces.json: duplicate namespace ${entry.namespace}`);
    }

    registered.add(entry.namespace);

    if (entry.introduction) {
      const introPath = path.join(docsDir, entry.introduction);

      if (!(await pathExists(introPath))) {
        errors.push(`hc_namespaces.json: missing introduction ${entry.introduction}`);
      }
    }
  }

  const fromManifest = new Set(Object.keys(hcManifest).map((key) => namespaceOfKey(key)));

  for (const ns of fromManifest) {
    if (!registered.has(ns)) {
      errors.push(`hc_namespaces.json: missing namespace ${ns} present in hc_sdk_manifest.json`);
    }
  }

  for (const ns of registered) {
    if (!fromManifest.has(ns)) {
      errors.push(`hc_namespaces.json: namespace ${ns} has no keys in hc_sdk_manifest.json`);
    }
  }

  if (errors.length > 0) {
    console.error('Namespace registry errors:');
    console.error(errors);
    process.exit(1);
  }
};

/**
 * Resolves a route path against known docs routes.
 *
 * @param {string} route Route path from a markdown link.
 * @param {Map<string, Set<string>>} routeAnchors Known route anchors.
 * @returns {string | undefined}
 */
const resolveRoute = (route, routeAnchors) => {
  if (routeAnchors.has(route)) {
    return route;
  }

  const withSlash = route.endsWith('/') ? route : `${route}/`;

  if (routeAnchors.has(withSlash)) {
    return withSlash;
  }

  const withoutSlash = route.endsWith('/') ? route.slice(0, -1) : route;

  if (routeAnchors.has(withoutSlash)) {
    return withoutSlash;
  }

  return undefined;
};

/**
 * Verifies manifest entries map to canonical files and no orphan pages remain.
 *
 * @returns {Promise<void>}
 */
const verifyManifestParity = async () => {
  const errors = [];

  if (!(await pathExists(path.join(docsDir, 'index.md')))) {
    errors.push('Missing canonical docs/index.md');
  }

  for (const slug of canonicalPageSlugs) {
    if (!(await pathExists(path.join(docsDir, `${slug}.md`)))) {
      errors.push(`Missing canonical docs/${slug}.md for manifest entry`);
    }
  }

  for (const slug of groupOverviewSlugs) {
    if (!(await pathExists(path.join(docsDir, slug, 'index.md')))) {
      errors.push(`Missing canonical docs/${slug}/index.md for manifest group`);
    }
  }

  const manifestSlugs = new Set(['index', ...canonicalPageSlugs]);
  const rootEntries = await readdir(docsDir, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const slug = entry.name.replace(/\.md$/, '');

    if (!manifestSlugs.has(slug)) {
      errors.push(`Orphan canonical docs page not listed in manifest: docs/${entry.name}`);
    }
  }

  const manifestGroupSlugs = new Set(groupOverviewSlugs);

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (manifestGroupSlugs.has(entry.name)) {
      continue;
    }

    if (['.vitepress', 'images', 'introductions'].includes(entry.name)) {
      continue;
    }

    errors.push(`Unexpected docs subdirectory: docs/${entry.name}`);
  }

  if (errors.length > 0) {
    console.error('Docs manifest parity errors:');
    console.error(errors);
    process.exit(1);
  }
};

/**
 * Verifies internal VitePress links in canonical markdown pages.
 *
 * @param {Map<string, { label: string; markdown: string; headings: ReturnType<typeof getHeadings> }>} canonicalPages Canonical page metadata.
 * @param {Map<string, Set<string>>} routeAnchors Known route anchors.
 */
const verifyInternalLinks = (canonicalPages, routeAnchors) => {
  const errors = [];

  for (const page of canonicalPages.values()) {
    for (const match of page.markdown.matchAll(INTERNAL_LINK_PATTERN)) {
      const route = match[1];

      if (
        route.startsWith('/images/') ||
        route.startsWith('/storybook') ||
        route.startsWith('/components/')
      ) {
        continue;
      }

      const anchor = match[2]?.slice(1);
      const resolvedRoute = resolveRoute(route, routeAnchors);

      if (!resolvedRoute) {
        errors.push(`${page.label}: unresolved internal link ${match[0]}`);
        continue;
      }

      if (anchor && !routeAnchors.get(resolvedRoute)?.has(anchor)) {
        errors.push(`${page.label}: unresolved anchor in ${match[0]}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Unresolved docs internal links:');
    console.error(errors);
    process.exit(1);
  }
};

/**
 * Verifies GitHub alert syntax in markdown documents.
 *
 * @param {string} label Document label for error output.
 * @param {string} markdown Markdown contents.
 */
const verifyGfmAlerts = (label, markdown) => {
  const malformedGfmAlerts = [
    ...markdown.matchAll(/^(?!\s*>)\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gim)
  ];

  if (malformedGfmAlerts.length > 0) {
    console.error(
      `Malformed GitHub alerts in ${label}: the marker line must be a blockquote (\`> [!TIP]\`), not a bare \`[!TIP]\` line.`
    );
    console.error(malformedGfmAlerts.map((match) => match[0]));
    process.exit(1);
  }
};

await verifyManifestParity();

const hcManifest = await loadHcManifest();
const namespaces = await loadHcNamespaces();
await verifyNamespaceRegistry(hcManifest, namespaces);
const canonicalPages = await loadCanonicalPages(hcManifest);
const routeAnchors = await buildRouteAnchorMap(canonicalPages, hcManifest);

for (const page of canonicalPages.values()) {
  verifyHeadingSlugs(page.label, page.headings);
  verifyGfmAlerts(page.label, page.markdown);
}

for (const ns of namespaces) {
  const pagePath = path.join(docsDir, 'api', `${ns.namespace}.md`);
  const markdown = await readFile(pagePath, 'utf8');
  const headings = getHeadings(markdown, hcManifest);
  verifyHeadingSlugs(`docs/api/${ns.namespace}.md`, headings);
  verifyGfmAlerts(`docs/api/${ns.namespace}.md`, markdown);
}

await verifyHcMethodTags(canonicalPages, hcManifest, namespaces);

// Generated API pages also carry intro links that must resolve.
for (const ns of namespaces) {
  const pagePath = path.join(docsDir, 'api', `${ns.namespace}.md`);
  const markdown = await readFile(pagePath, 'utf8');
  canonicalPages.set(`/api/${ns.namespace}`, {
    label: `docs/api/${ns.namespace}.md`,
    markdown,
    headings: getHeadings(markdown, hcManifest)
  });
}

verifyInternalLinks(canonicalPages, routeAnchors);

console.log(
  `Verified ${docsNav.length} manifest entries, ${canonicalPages.size} canonical docs routes, ${namespaces.length} namespaces, ${Object.keys(hcManifest).length} hc APIs, and ${routeAnchors.size} routable paths.`
);
