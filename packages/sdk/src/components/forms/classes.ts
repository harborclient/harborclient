/**
 * Shared Tailwind class strings for macOS-style form controls.
 */
import { cn } from '../utils.js';

/**
 * Visual style preset for form field wrappers.
 */
export type FieldVariant = 'control' | 'surface' | 'plain';

/**
 * Border and subtle tint shell for composite inputs (e.g. VariableInput wrappers).
 */
export const fieldFrame = 'overflow-hidden rounded-lg border border-separator bg-field';

/** Inset control style for standard settings and editor fields. */
export const field =
  'rounded-lg border border-separator bg-field px-2.5 py-1.5 text-text app-no-drag';

/** Surface style for modal and Team Hub form fields. */
export const surfaceField =
  'w-full rounded-lg border border-separator bg-field px-3 py-2.5 text-[15px] text-text';

/** Transparent overlay checkbox input sized to {@link checkboxBox}. */
export const checkboxInput =
  'peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';

/** Custom checkbox box styled via `peer-checked` / `peer-focus-visible` on {@link checkboxInput}. */
export const checkboxBox =
  'pointer-events-none flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-separator bg-field text-white peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100';

/** Transparent overlay radio input sized to {@link radioCircle}. */
export const radioInput =
  'peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed';

/** Custom radio circle styled via `peer-checked` / `peer-focus-visible` on {@link radioInput}. */
export const radioCircle =
  'pointer-events-none relative h-[18px] w-[18px] shrink-0 leading-none rounded-full border border-separator bg-field peer-checked:border-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50 [&>span]:opacity-0 peer-checked:[&>span]:opacity-100';

/** Checked-state dot centered inside {@link radioCircle}. */
export const radioDot =
  'absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 shrink-0 rounded-full bg-accent';

/**
 * Merges a field variant preset with optional caller classes.
 *
 * @param variant - Base styling preset; `plain` applies no preset classes.
 * @param className - Additional Tailwind classes appended after the preset.
 * @param rootClass - Stable component root class prepended to the result.
 * @returns Combined class string, or undefined when all inputs are empty.
 */
export function mergeFieldClasses(
  variant: FieldVariant,
  className?: string,
  rootClass?: string
): string | undefined {
  const result = cn(
    rootClass,
    variant === 'control' ? field : variant === 'surface' ? surfaceField : undefined,
    className
  );
  return result === '' ? undefined : result;
}
