import type { Variable } from '#/shared/types';

export const cleanVariables = (variables: Variable[]): Variable[] =>
  variables.filter((v) => v.key.trim() || v.value.trim() || v.defaultValue.trim());
