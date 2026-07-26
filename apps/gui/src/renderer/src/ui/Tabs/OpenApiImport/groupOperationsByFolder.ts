import type { ParsedOpenApiOperation } from '@harborclient/core/openapi';

/**
 * Groups parsed operations by their OpenAPI tag folder for preview rendering.
 *
 * @param operations - Flattened operations from the parsed spec.
 * @returns Folder names mapped to operation rows, sorted by folder label.
 */
export function groupOperationsByFolder(
  operations: ParsedOpenApiOperation[]
): Map<string, ParsedOpenApiOperation[]> {
  const groups = new Map<string, ParsedOpenApiOperation[]>();

  for (const operation of operations) {
    const folder = operation.folder ?? '';
    const existing = groups.get(folder) ?? [];
    existing.push(operation);
    groups.set(folder, existing);
  }

  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
