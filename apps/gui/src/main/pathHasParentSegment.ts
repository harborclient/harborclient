/**
 * Returns whether a path contains a parent-directory (`..`) segment.
 *
 * Checks path segments after unifying backslashes to forward slashes. This
 * detects traversal components such as `foo/../bar`, not literal `..`
 * substrings inside a segment (e.g. `backup..2024`).
 *
 * @param targetPath - Path to inspect.
 * @returns True when any segment equals `..`.
 */
export function pathHasParentSegment(targetPath: string): boolean {
  return targetPath
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => segment === '..');
}
