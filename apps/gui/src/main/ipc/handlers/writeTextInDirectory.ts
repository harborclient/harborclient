import { access } from 'fs/promises';
import { basename, isAbsolute, join, resolve, sep } from 'path';

/**
 * Returns whether a candidate absolute path is inside a resolved directory root.
 *
 * @param directoryResolved - Absolute resolved directory root.
 * @param fileResolved - Absolute resolved file path.
 * @returns True when the file path is equal to or nested under the directory.
 */
export function isPathInsideDirectory(directoryResolved: string, fileResolved: string): boolean {
  if (fileResolved === directoryResolved) {
    return false;
  }
  const prefix = directoryResolved.endsWith(sep) ? directoryResolved : `${directoryResolved}${sep}`;
  return fileResolved.startsWith(prefix);
}

/**
 * Resolves a write destination under a directory, rejecting path traversal.
 *
 * @param directory - Destination directory (absolute preferred).
 * @param fileName - Basename only; directory separators are rejected.
 * @returns Absolute file path confined to the directory.
 * @throws When directory/fileName are invalid or the resolved path escapes the directory.
 */
export function resolveWritePathInDirectory(directory: string, fileName: string): string {
  const trimmedDirectory = directory.trim();
  const trimmedName = fileName.trim();
  if (!trimmedDirectory) {
    throw new Error('Directory path is required');
  }
  if (!trimmedName) {
    throw new Error('File name is required');
  }
  if (trimmedName !== basename(trimmedName) || trimmedName.includes('..')) {
    throw new Error('File name must be a basename without directory separators');
  }

  const directoryResolved = resolve(trimmedDirectory);
  const fileResolved = resolve(join(directoryResolved, trimmedName));
  if (!isPathInsideDirectory(directoryResolved, fileResolved)) {
    throw new Error('Resolved file path escapes the destination directory');
  }
  if (!isAbsolute(fileResolved)) {
    throw new Error('Resolved file path must be absolute');
  }
  return fileResolved;
}

/**
 * Splits a basename into stem and extension for collision suffixes.
 *
 * @param fileName - Basename such as `workflow-2026-07-28-13-59-01.json`.
 * @returns Stem and extension (extension includes the leading dot when present).
 */
function splitFileName(fileName: string): { stem: string; extension: string } {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return { stem: fileName, extension: '' };
  }
  return {
    stem: fileName.slice(0, extensionIndex),
    extension: fileName.slice(extensionIndex)
  };
}

/**
 * Picks an unused absolute path under a directory for the preferred basename.
 *
 * Tries the preferred name first, then `stem-2.ext`, `stem-3.ext`, …
 *
 * @param directory - Destination directory.
 * @param fileName - Preferred basename.
 * @returns Absolute path that does not currently exist.
 */
export async function resolveAvailableWritePathInDirectory(
  directory: string,
  fileName: string
): Promise<string> {
  const preferred = resolveWritePathInDirectory(directory, fileName);
  try {
    await access(preferred);
  } catch {
    return preferred;
  }

  const baseName = basename(preferred);
  const { stem, extension } = splitFileName(baseName);
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidateName = `${stem}-${suffix}${extension}`;
    const candidate = resolveWritePathInDirectory(directory, candidateName);
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }

  throw new Error('Could not find an available filename in the destination directory');
}
