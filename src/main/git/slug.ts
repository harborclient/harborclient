import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Recursively counts files under a directory containing git conflict markers.
 *
 * @param dir - Directory to scan.
 */
export function countConflictFiles(dir: string): number {
  if (!existsSync(dir)) {
    return 0;
  }

  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countConflictFiles(full);
      continue;
    }
    if (!entry.name.endsWith('.json')) {
      continue;
    }
    const text = readFileSync(full, 'utf-8');
    if (text.includes('<<<<<<<')) {
      count += 1;
    }
  }
  return count;
}

/**
 * Builds a user-facing message when pull stops due to merge conflict markers.
 *
 * @param conflictCount - Number of JSON files containing conflict markers.
 * @returns Error message guiding the user to resolve markers in their editor.
 */
export function pullMergeConflictMessage(conflictCount: number): string {
  const fileLabel = conflictCount === 1 ? 'file has' : 'files have';
  return (
    `Pull could not finish: ${conflictCount} ${fileLabel} merge conflicts. ` +
    'Open the affected collection or environment JSON files in your editor, resolve the ' +
    '<<<<<<< conflict markers, then pull again.'
  );
}

/**
 * Converts a display name into a filesystem-safe slug for git-backed paths.
 *
 * @param name - Human-readable name (collection or request).
 * @returns Lowercase slug with non-alphanumeric characters replaced by hyphens.
 */
export function toFileSlug(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

/**
 * Builds a directory or file prefix combining a stable uuid and human slug.
 *
 * @param uuid - Stable document uuid.
 * @param name - Display name used for the slug portion.
 * @returns Prefix string `uuid-slug`.
 */
export function uuidSlugPrefix(uuid: string, name: string): string {
  return `${uuid}-${toFileSlug(name)}`;
}
