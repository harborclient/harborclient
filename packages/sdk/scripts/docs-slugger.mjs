/**
 * Shared heading slug helpers for docs validation and VitePress anchor ids.
 */

/**
 * Removes inline Markdown syntax that should not participate in anchor ids.
 *
 * @param {string} value Markdown heading text.
 * @returns {string} Plain heading text.
 */
export const normalizeHeadingText = (value) =>
  value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();

/**
 * Converts a heading to the anchor id used in README TOC links and VitePress headings.
 *
 * @param {string} value Markdown heading text.
 * @returns {string} Anchor id.
 */
export const toAnchor = (value) =>
  normalizeHeadingText(value)
    .toLowerCase()
    .replace(/&amp;/g, '')
    .replace(/&/g, '')
    .replace(/\s/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .trim()
    .replace(/^-+|-+$/g, '');

/**
 * Matches a VitePress `<HcMethod name="…" />` (optional `:level`) tag on a line.
 *
 * @param {string} line Markdown / Vue line.
 * @returns {{ name: string; level?: number } | null}
 */
export const parseHcMethodTag = (line) => {
  const match =
    /^<HcMethod\s+name="([^"]+)"(?:\s+:level="(\d)")?\s*\/>\s*$/.exec(line.trim()) ||
    /^<HcMethod\s+name="([^"]+)"(?:\s+:level='(\d)')?\s*\/>\s*$/.exec(line.trim());

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    level: match[2] ? Number(match[2]) : undefined
  };
};

/**
 * Extracts markdown headings and virtual `<HcMethod>` headings from markdown.
 *
 * @param {string} markdown Markdown contents.
 * @param {Record<string, { title: string; level: number }> | null | undefined} [manifest]
 *   Optional `hc_manifest.json` map for expanding HcMethod tags.
 * @returns {{ level: number; title: string; anchor: string }[]} Heading metadata.
 */
export const getHeadings = (markdown, manifest) => {
  const usedAnchors = new Map();
  /** @type {{ level: number; title: string; anchor: string }[]} */
  const headings = [];

  /**
   * Records one heading while preserving duplicate-anchor suffixes.
   *
   * @param {number} level Heading level.
   * @param {string} title Heading title.
   */
  const pushHeading = (level, title) => {
    if (title === 'Table of contents') {
      return;
    }

    const anchor = toAnchor(title);
    const anchorCount = usedAnchors.get(anchor) ?? 0;

    usedAnchors.set(anchor, anchorCount + 1);

    headings.push({
      level,
      title,
      anchor: anchorCount === 0 ? anchor : `${anchor}-${anchorCount}`
    });
  };

  for (const line of markdown.split('\n')) {
    const headingMatch = /^(#{2,6})\s+(.+)$/.exec(line);

    if (headingMatch) {
      pushHeading(headingMatch[1].length, headingMatch[2].trim());
      continue;
    }

    const hcTag = parseHcMethodTag(line);

    if (!hcTag) {
      continue;
    }

    if (!manifest || !manifest[hcTag.name]) {
      throw new Error(
        `HcMethod name="${hcTag.name}" is not present in hc_manifest.json`
      );
    }

    const entry = manifest[hcTag.name];
    const level = hcTag.level ?? entry.level;

    pushHeading(level, entry.title);
  }

  return headings;
};

/**
 * Collects every `<HcMethod name>` referenced in markdown.
 *
 * @param {string} markdown Markdown contents.
 * @returns {string[]} Manifest keys in document order.
 */
export const listHcMethodNames = (markdown) => {
  /** @type {string[]} */
  const names = [];

  for (const line of markdown.split('\n')) {
    const tag = parseHcMethodTag(line);

    if (tag) {
      names.push(tag.name);
    }
  }

  return names;
};
