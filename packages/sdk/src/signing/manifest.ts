import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9.-]*\.[a-zA-Z][a-zA-Z0-9.-]+$/;
const PLUGIN_MANIFEST_FILENAME = 'manifest.json';
const SNIPPET_MANIFEST_FILENAME = 'snippets.json';

/**
 * Minimal manifest fields required for plugin signing.
 */
export interface PluginManifestIdentity {
  id: string;
  version: string;
}

/**
 * Parses and validates id and version from a manifest.json or snippets.json file.
 *
 * @param manifestPath - Absolute path to the manifest file on disk.
 * @returns Parsed manifest identity fields.
 * @throws When the file is invalid JSON or fails validation.
 */
function parseManifestIdentityFile(manifestPath: string): PluginManifestIdentity {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Plugin manifest is not valid JSON: ${manifestPath}`, { cause: error });
  }

  if (typeof raw !== 'object' || raw == null) {
    throw new Error(`Plugin manifest must be a JSON object: ${manifestPath}`);
  }

  const record = raw as Record<string, unknown>;
  const id = record.id;
  const version = record.version;

  if (typeof id !== 'string' || !PLUGIN_ID_PATTERN.test(id)) {
    throw new Error(`Plugin manifest id is invalid: ${manifestPath}`);
  }
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(`Plugin manifest version is invalid: ${manifestPath}`);
  }

  return { id, version };
}

/**
 * Reads and validates plugin id and version from manifest.json or snippets.json.
 *
 * Prefers manifest.json when both files are present.
 *
 * @param pluginDir - Plugin or snippet bundle root directory.
 * @returns Parsed manifest identity fields.
 * @throws When neither manifest file exists or validation fails.
 */
export function readPluginManifestIdentity(pluginDir: string): PluginManifestIdentity {
  const manifestPath = join(pluginDir, PLUGIN_MANIFEST_FILENAME);
  if (existsSync(manifestPath)) {
    return parseManifestIdentityFile(manifestPath);
  }

  const snippetsPath = join(pluginDir, SNIPPET_MANIFEST_FILENAME);
  if (existsSync(snippetsPath)) {
    return parseManifestIdentityFile(snippetsPath);
  }

  throw new Error(
    `Plugin or snippet manifest not found: expected ${PLUGIN_MANIFEST_FILENAME} or ${SNIPPET_MANIFEST_FILENAME} in ${pluginDir}`
  );
}
