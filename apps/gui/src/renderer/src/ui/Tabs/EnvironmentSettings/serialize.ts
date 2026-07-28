import { cleanVariables } from '@harborclient/sdk/components';
import type { Variable } from '@harborclient/core/types';

/**
 * Serializes environment form fields for dirty-state comparison and persistence.
 *
 * @param name - Environment display name.
 * @param variables - Environment-scoped variable rows.
 * @param parentUuid - Parent environment uuid, or null when a root.
 */
export const serializeEnvironmentForm = (
  name: string,
  variables: Variable[],
  parentUuid: string | null
): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables),
    parentUuid
  });
