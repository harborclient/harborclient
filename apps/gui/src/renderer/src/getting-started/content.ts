/**
 * Eager-loaded markdown documents from the getting-started directory.
 */
const markdownModules = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/**
 * Eager-loaded image assets from the getting-started directory.
 */
const imageModules = import.meta.glob('./**/*.{png,jpg,jpeg,gif,svg,webp}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

/** Default document shown when the Getting Started tab opens. */
export const GETTING_STARTED_DEFAULT_DOC = 'index.md';

/**
 * Normalizes a getting-started relative path to forward slashes without a leading `./`.
 *
 * @param path - Raw path from a glob key or markdown link.
 * @returns Normalized relative path.
 */
export function normalizeGettingStartedPath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Resolves a relative target path against a base markdown document path.
 *
 * @param baseDocPath - Path of the document containing the link, e.g. `index.md`.
 * @param relativeTarget - Href from markdown, e.g. `./assets/logo.png`.
 * @returns Resolved path relative to the getting-started root.
 */
export function resolveGettingStartedRelativePath(
  baseDocPath: string,
  relativeTarget: string
): string {
  const baseDir = baseDocPath.includes('/')
    ? baseDocPath.slice(0, baseDocPath.lastIndexOf('/') + 1)
    : '';
  const combined = `${baseDir}${relativeTarget}`.replace(/\\/g, '/');
  const segments = combined.split('/');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }
    if (segment === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join('/');
}

/**
 * Returns whether a URL should be treated as an external absolute link.
 *
 * @param href - Link target from markdown.
 * @returns True for http(s), mailto, and hash-only anchors.
 */
export function isExternalGettingStartedHref(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#')
  );
}

/**
 * Looks up markdown content by path within the getting-started bundle.
 *
 * @param docPath - Relative path such as `index.md`.
 * @returns Raw markdown string or null when the file is not bundled.
 */
export function getGettingStartedDocContent(docPath: string): string | null {
  const normalized = normalizeGettingStartedPath(docPath);
  const directKey = `./${normalized}`;
  if (markdownModules[directKey] != null) {
    return markdownModules[directKey];
  }

  const match = Object.entries(markdownModules).find(
    ([key]) => normalizeGettingStartedPath(key) === normalized
  );
  return match?.[1] ?? null;
}

/**
 * Resolves a relative image source against the current document path.
 *
 * @param currentDocPath - Path of the markdown file rendering the image.
 * @param src - Image `src` attribute from markdown.
 * @returns Bundled asset URL, the original src for absolute URLs, or undefined.
 */
export function resolveGettingStartedImageSrc(
  currentDocPath: string,
  src: string | undefined
): string | undefined {
  if (src == null || src.length === 0) {
    return undefined;
  }

  if (isExternalGettingStartedHref(src)) {
    return src;
  }

  const resolved = resolveGettingStartedRelativePath(currentDocPath, src);
  const directKey = `./${resolved}`;
  if (imageModules[directKey] != null) {
    return imageModules[directKey];
  }

  const match = Object.entries(imageModules).find(
    ([key]) => normalizeGettingStartedPath(key) === resolved
  );
  return match?.[1];
}

/**
 * Returns sorted relative paths for bundled markdown files (for diagnostics).
 *
 * @returns Markdown paths relative to the getting-started root.
 */
export function listGettingStartedDocPaths(): string[] {
  return Object.keys(markdownModules)
    .map((key) => normalizeGettingStartedPath(key))
    .sort((a, b) => a.localeCompare(b));
}
