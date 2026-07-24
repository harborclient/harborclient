import { cleanVariables } from '@harborclient/sdk/components';
import type { Variable } from '#/shared/types';

/**
 * Serializes globals form state for dirty comparison and form remount keys.
 *
 * @param variables - Global variable rows from the form.
 * @returns JSON string of cleaned variables.
 */
export function serializeGlobalsForm(variables: Variable[]): string {
  return JSON.stringify(cleanVariables(variables));
}
