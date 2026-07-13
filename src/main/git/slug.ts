import { promises as fsp } from 'fs';

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
 * Builds a directory or file prefix combining a stable uuid and human slug.
 *
 * @param uuid - Stable document uuid.
 * @param name - Display name used for the slug portion.
 * @returns Prefix string `uuid-slug`.
 */
export function uuidSlugPrefix(uuid: string, name: string): string {
  return `${uuid}-${toFileSlug(name)}`;
}
