import type { Variable } from '../types';
/**
 * Coerces a partial or legacy variable record to the full Variable shape.
 *
 * @param v - Raw variable fields from storage or import.
 * @returns Normalized variable with defaults for missing fields.
 */
export declare function normalizeVariable(v: Partial<Variable>): Variable;
//# sourceMappingURL=variables.d.ts.map