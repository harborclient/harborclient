/**
 * Normalized path parts used to match markdown image targets against plugin screenshots.
 */
interface ScreenshotMatchers {
  /** Lowercase repository-relative paths and URL pathnames. */
  fullPaths: Set<string>;
  /** Lowercase filename-only keys for README-relative image links. */
  basenames: Set<string>;
}

/**
 * Normalizes a manifest path or absolute URL into comparable path segments.
 *
 * @param ref - Manifest screenshot path or resolved catalog URL.
 */
function normalizeScreenshotRef(ref: string): { fullPath: string; basename: string } {
  const trimmed = ref.trim();
  try {
    const url = new URL(trimmed);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const basename = path.split('/').pop() ?? path;
    return { fullPath: path.toLowerCase(), basename: basename.toLowerCase() };
  } catch {
    const path = decodeURIComponent(trimmed.replace(/^\.\//, '').replace(/^\/+/, ''));
    const basename = path.split('/').pop() ?? path;
    return { fullPath: path.toLowerCase(), basename: basename.toLowerCase() };
  }
}

/**
 * Builds lookup sets from manifest and catalog screenshot references.
 *
 * @param screenshotRefs - Manifest-relative paths and/or resolved catalog URLs.
 */
function buildScreenshotMatchers(screenshotRefs: string[]): ScreenshotMatchers {
  const fullPaths = new Set<string>();
  const basenames = new Set<string>();

  for (const ref of screenshotRefs) {
    const { fullPath, basename } = normalizeScreenshotRef(ref);
    if (fullPath.length > 0) {
      fullPaths.add(fullPath);
    }
    if (basename.length > 0) {
      basenames.add(basename);
    }
  }

  return { fullPaths, basenames };
}

/**
 * Returns true when a markdown image target refers to a known plugin screenshot.
 *
 * @param target - URL or path from markdown image syntax.
 * @param matchers - Normalized screenshot lookup sets.
 */
function isPluginScreenshotImageTarget(target: string, matchers: ScreenshotMatchers): boolean {
  if (matchers.fullPaths.size === 0 && matchers.basenames.size === 0) {
    return false;
  }

  const { fullPath, basename } = normalizeScreenshotRef(target);
  if (fullPath.length > 0 && matchers.fullPaths.has(fullPath)) {
    return true;
  }

  return basename.length > 0 && matchers.basenames.has(basename);
}

/** Inline markdown image: `![alt](path)` or `![alt](path "title")`. */
const INLINE_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

/** Reference-style image usage: `![alt][id]`. */
const REFERENCE_IMAGE_USAGE_PATTERN = /!\[[^\]]*\]\[([^\]]+)\]/g;

/** Reference definition line: `[id]: path`. */
const REFERENCE_DEFINITION_PATTERN = /^\s*\[([^\]]+)\]:\s*(\S+)(?:\s+"[^"]*")?\s*$/gm;

/**
 * Removes inline markdown images whose targets match plugin screenshot refs.
 *
 * @param markdown - Description markdown body.
 * @param matchers - Normalized screenshot lookup sets.
 */
function stripInlineScreenshotImages(markdown: string, matchers: ScreenshotMatchers): string {
  return markdown.replace(INLINE_IMAGE_PATTERN, (match, target: string) => {
    return isPluginScreenshotImageTarget(target, matchers) ? '' : match;
  });
}

/**
 * Removes reference-style markdown images and their link definitions for plugin screenshots.
 *
 * @param markdown - Description markdown body.
 * @param matchers - Normalized screenshot lookup sets.
 */
function stripReferenceScreenshotImages(markdown: string, matchers: ScreenshotMatchers): string {
  const screenshotReferenceIds = new Set<string>();

  for (const match of markdown.matchAll(REFERENCE_DEFINITION_PATTERN)) {
    const id = match[1];
    const target = match[2];
    if (id && target && isPluginScreenshotImageTarget(target, matchers)) {
      screenshotReferenceIds.add(id.toLowerCase());
    }
  }

  if (screenshotReferenceIds.size === 0) {
    return markdown;
  }

  let result = markdown.replace(
    REFERENCE_DEFINITION_PATTERN,
    (line, id: string, target: string) => {
      if (screenshotReferenceIds.has(id.toLowerCase())) {
        return '';
      }
      if (isPluginScreenshotImageTarget(target, matchers)) {
        return '';
      }
      return line;
    }
  );

  result = result.replace(REFERENCE_IMAGE_USAGE_PATTERN, (match, id: string) => {
    return screenshotReferenceIds.has(id.toLowerCase()) ? '' : match;
  });

  return result;
}

/**
 * Trims trailing whitespace per line and collapses excessive blank lines.
 *
 * @param markdown - Markdown after image removal.
 */
function cleanupMarkdownWhitespace(markdown: string): string {
  const trimmedLines = markdown
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');

  return trimmedLines.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Removes markdown image syntax for plugin screenshots already shown in the detail carousel.
 *
 * @param markdown - Raw plugin README or description markdown.
 * @param screenshotRefs - Manifest screenshot paths and/or resolved catalog URLs.
 * @returns Markdown with redundant screenshot images removed.
 */
export function stripPluginScreenshotImagesFromMarkdown(
  markdown: string,
  screenshotRefs: string[]
): string {
  if (!markdown.trim() || screenshotRefs.length === 0) {
    return markdown.trim();
  }

  const matchers = buildScreenshotMatchers(screenshotRefs);
  let result = stripReferenceScreenshotImages(markdown, matchers);
  result = stripInlineScreenshotImages(result, matchers);
  return cleanupMarkdownWhitespace(result);
}
