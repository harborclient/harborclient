/**
 * Collects absolute filesystem paths previously saved in plugin storage.
 *
 * Scans persisted JSON for `dotenvPath` fields so linked `.env` files regain
 * allowlist access after restart without requiring another Browse action.
 *
 * @param entries - Plugin storage rows for one plugin id.
 */
export function collectFilesystemPathsFromPluginStorage(
  entries: ReadonlyArray<{ key: string; value: string }>
): string[] {
  const paths = new Set<string>();
  for (const entry of entries) {
    try {
      collectDotenvPaths(JSON.parse(entry.value) as unknown, paths);
    } catch {
      // Ignore invalid JSON blobs in unrelated storage keys.
    }
  }
  return [...paths];
}

/**
 * Recursively collects `dotenvPath` string fields from parsed plugin storage JSON.
 *
 * @param value - Parsed JSON value from one storage row.
 * @param paths - Accumulator for normalized absolute paths.
 */
function collectDotenvPaths(value: unknown, paths: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDotenvPaths(item, paths);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === 'dotenvPath' && typeof nested === 'string') {
      const trimmed = nested.trim();
      if (trimmed.length > 0) {
        paths.add(trimmed);
      }
      continue;
    }
    collectDotenvPaths(nested, paths);
  }
}
