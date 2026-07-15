import { app } from 'electron';
import { isNewerVersion, normalizeVersion } from './versionCompare';
import type { UpdateCheckResult } from '#/shared/types';

const RELEASES_URL = 'https://github.com/harborclient/harborclient/releases';
const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/harborclient/harborclient/releases/latest';

/**
 * Fetches the latest release tag name from the GitHub Releases API.
 *
 * @returns Normalized semver of the latest published release.
 * @throws When the request fails or the response lacks a tag name.
 */
async function fetchLatestReleaseVersion(): Promise<string> {
  const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to check for updates (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { tag_name?: string };
  if (!data.tag_name) {
    throw new Error('Release response did not include a version tag');
  }

  return normalizeVersion(data.tag_name);
}

/**
 * Compares the running application version against the latest GitHub release.
 *
 * @returns Current and latest versions, availability flag, and releases page URL.
 * @throws When the GitHub request fails or returns invalid data.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  const latestVersion = await fetchLatestReleaseVersion();

  return {
    currentVersion,
    latestVersion,
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    releaseUrl: RELEASES_URL
  };
}
