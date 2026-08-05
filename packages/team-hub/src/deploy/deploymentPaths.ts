import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  DEPLOY_DIR_ENV_VAR,
  DEPLOY_DIR_NAME,
  DEFAULT_GHCR_IMAGE,
  GHCR_IMAGE_ENV_VAR
} from '#/deploy/constants.js';
import { isSafeDirectoryPath } from '#/deploy/validation.js';

/**
 * Resolves the platform-specific default deployment directory for Team Hub.
 *
 * Team Hub targets Linux servers; the default follows the XDG config directory
 * convention (`~/.config/team-hub`).
 *
 * @returns Absolute path to the default managed deployment directory.
 */
export function defaultDeploymentDirectory(): string {
  return path.join(homedir(), '.config', DEPLOY_DIR_NAME);
}

/**
 * Resolves the managed deployment directory from CLI flags and environment.
 *
 * @param override - Optional explicit directory from a CLI flag.
 * @returns Absolute deployment directory path.
 * @throws Error when the supplied path is unsafe.
 */
export function resolveDeploymentDirectory(override?: string): string {
  const candidate = override ?? process.env[DEPLOY_DIR_ENV_VAR] ?? defaultDeploymentDirectory();

  if (!isSafeDirectoryPath(candidate)) {
    throw new Error(`Unsafe deployment directory path: ${candidate}`);
  }

  return path.resolve(candidate);
}

/**
 * Resolves the GHCR image repository (without tag) used in deployment templates.
 *
 * @returns Lowercase GHCR image reference such as `ghcr.io/harborclient/team-hub`.
 */
export function resolveGhcrImageRepository(): string {
  const configured = process.env[GHCR_IMAGE_ENV_VAR]?.trim();
  return configured && configured.length > 0 ? configured.toLowerCase() : DEFAULT_GHCR_IMAGE;
}

/**
 * Builds a fully qualified container image reference with tag.
 *
 * @param tag - Image tag such as `latest` or `0.7.6`.
 * @returns Image reference in `repository:tag` form.
 */
export function formatImageReference(tag: string): string {
  return `${resolveGhcrImageRepository()}:${tag}`;
}

/**
 * Returns bundled deploy asset paths relative to the installed npm package root.
 *
 * @param packageRoot - Absolute path to the published package directory.
 * @returns Paths to compose and env example templates shipped with the npm package.
 */
export function bundledDeployAssetPaths(packageRoot: string): {
  composeTemplate: string;
  envExample: string;
} {
  return {
    composeTemplate: path.join(packageRoot, 'deploy', 'compose.yaml'),
    envExample: path.join(packageRoot, 'deploy', '.env.example')
  };
}

/**
 * Resolves the npm package root directory from a module URL (for example import.meta.url).
 *
 * @param moduleUrl - Module URL for a file inside the published package.
 * @returns Absolute package root path containing package.json.
 */
export function resolvePackageRootFromModuleUrl(moduleUrl: string): string {
  const filePath = fileURLToPath(moduleUrl);
  return path.resolve(path.dirname(filePath), '..', '..');
}
