/**
 * Strips a leading "v" prefix from a version tag or semver string.
 *
 * @param version - Raw version or tag name from package metadata or GitHub.
 * @returns Normalized semver without a leading "v".
 */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

/**
 * Parses a semver string into numeric segments for comparison.
 *
 * @param version - Semver string, optionally prefixed with "v".
 * @returns Numeric major/minor/patch segments.
 */
function parseVersionSegments(version: string): number[] {
  return normalizeVersion(version)
    .split('.')
    .map((segment) => Number.parseInt(segment, 10))
    .map((value) => (Number.isNaN(value) ? 0 : value));
}

/**
 * Compares two semver strings numerically by major, minor, and patch.
 *
 * @param left - First version to compare.
 * @param right - Second version to compare.
 * @returns Negative when left is older, positive when newer, zero when equal.
 */
export function compareVersions(left: string, right: string): number {
  const leftSegments = parseVersionSegments(left);
  const rightSegments = parseVersionSegments(right);
  const length = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftSegments[index] ?? 0;
    const rightValue = rightSegments[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

/**
 * Returns whether the latest version is newer than the current version.
 *
 * @param latestVersion - Version from the newest GitHub release.
 * @param currentVersion - Version of the running application.
 * @returns True when an update is available.
 */
export function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}
