import type { Variable } from '#/shared/types';

/**
 * Coerces a partial or legacy variable record to the full Variable shape.
 *
 * @param v - Raw variable fields from storage or import.
 * @returns Normalized variable with defaults for missing fields.
 */
export function normalizeVariable(v: Partial<Variable>): Variable {
  return {
    key: typeof v.key === 'string' ? v.key : '',
    value: typeof v.value === 'string' ? v.value : '',
    defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : '',
    share: v.share === true
  };
}
