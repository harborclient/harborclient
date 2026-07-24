import { cleanVariables } from '@harborclient/sdk/components';
import type { Variable } from '#/shared/types';

/**
 * Serializes environment form fields for dirty-state comparison and persistence.
 *
 * @param name - Environment display name.
 * @param variables - Environment-scoped variable rows.
 */
export const serializeEnvironmentForm = (name: string, variables: Variable[]): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables)
  });
