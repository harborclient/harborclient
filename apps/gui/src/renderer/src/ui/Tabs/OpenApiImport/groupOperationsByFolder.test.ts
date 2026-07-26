import { describe, expect, it } from 'vitest';
import type { ParsedOpenApiOperation } from '@harborclient/core/openapi';
import { groupOperationsByFolder } from './groupOperationsByFolder';

/**
 * Builds a minimal parsed operation for grouping tests.
 *
 * @param id - Stable operation id.
 * @param folder - Optional OpenAPI tag folder.
 */
function operation(id: string, folder?: string): ParsedOpenApiOperation {
  return {
    id,
    name: id,
    method: 'GET',
    url: `https://example.com/${id}`,
    folder
  };
}

describe('groupOperationsByFolder', () => {
  it('groups by tag folder and sorts folder labels', () => {
    const grouped = groupOperationsByFolder([
      operation('users-list', 'users'),
      operation('pets-list', 'pets'),
      operation('root'),
      operation('pets-create', 'pets')
    ]);

    expect([...grouped.keys()]).toEqual(['', 'pets', 'users']);
    expect(grouped.get('pets')?.map((entry) => entry.id)).toEqual(['pets-list', 'pets-create']);
    expect(grouped.get('')?.map((entry) => entry.id)).toEqual(['root']);
  });
});
