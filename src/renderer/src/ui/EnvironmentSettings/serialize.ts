import type { Variable } from '#/shared/types';
import { cleanVariables } from '#/renderer/src/components/variableUtils';

export const serializeEnvironmentForm = (name: string, variables: Variable[]): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables)
  });
