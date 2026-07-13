import { promises as fsp } from 'fs';

/**
 * Returns whether text contains git merge conflict markers.
 *
 * @param text - File contents to inspect.
 */
export function hasConflictMarkers(text: string | null | undefined): boolean {
  return text != null && text.includes('<<<<<<<');
}

/**
 * Counts JSON files in the provided list whose contents contain git conflict markers.
 *
 * Intended for modified paths from `git.statusMatrix` so status polling avoids
 * scanning the entire HarborClient tree on every refresh.
 *
 * @param files - Absolute paths to candidate JSON files.
 * @returns Number of files containing `<<<<<<<` conflict markers.
 */
export async function countConflictFiles(files: string[]): Promise<number> {
  const results = await Promise.all(
    files.map(async (filePath) => {
      if (!filePath.endsWith('.json')) {
        return 0;
      }
      try {
        const text = await fsp.readFile(filePath, 'utf-8');
        return text.includes('<<<<<<<') ? 1 : 0;
      } catch {
        return 0;
      }
    })
  );
  return results.reduce<number>((sum, count) => sum + count, 0);
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
 * Removes a trailing `.md` extension from a document display name before slugging.
 *
 * @param name - Document display name (for example README.md).
 */
export function stripMdExtension(name: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase().endsWith('.md')) {
    return trimmed.slice(0, -3).trim();
  }
  return trimmed;
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
 * HarborClient export kinds used as filename prefixes at the git harbor root.
 */
export type HarborExportFileKind = 'collection' | 'environment' | 'snippet';

/**
 * Builds the base name for a HarborClient export JSON file at the harbor root.
 *
 * @param kind - Export discriminator (`collection`, `environment`, or `snippet`).
 * @param name - Display name slugged for filesystem safety.
 * @returns Base name `kind-slug` without the `.json` extension.
 */
export function exportFileBaseName(kind: HarborExportFileKind, name: string): string {
  return `${kind}-${toFileSlug(name)}`;
}
