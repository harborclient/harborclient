import { useId } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { FieldError } from '../FieldError/index.js';
import { enhanceControl } from '../enhanceControl.js';

/**
 * Layout preset for label and control placement within a form group.
 */
export type FormGroupLayout =
  | 'stacked'
  | 'checkbox'
  | 'inline'
  | 'radio'
  | 'checkboxAdjacent'
  | 'associated';

/**
 * Label color tone for form group headings.
 */
export type FormGroupLabelTone = 'default' | 'muted';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> {
  /**
   * Visible label text, or screen-reader-only text when `srOnly` is set.
   */
  label: ReactNode;

  /**
   * Form control(s) rendered inside or beside the label. Omitted for `associated` layout.
   */
  children?: ReactNode;

  /**
   * Associates the label with a control via `htmlFor`.
   */
  htmlFor?: string;

  /**
   * Muted helper text rendered below the label and above the control (stacked layout),
   * or below the checkbox row inside the bordered box (checkbox layout).
   */
  description?: ReactNode;

  /**
   * Validation error rendered below the control with linked `aria-describedby`.
   */
  error?: ReactNode;

  /**
   * Explicit id for the error element; defaults to `${htmlFor}-error` when `htmlFor` is set.
   */
  errorId?: string;

  /**
   * Explicit id for the description element; defaults to `${htmlFor}-description` when `htmlFor` is set.
   */
  descriptionId?: string;

  /**
   * Label and control placement. Defaults to stacked (label above control).
   */
  layout?: FormGroupLayout;

  /**
   * Label color style. Defaults to prominent `text-text`.
   */
  labelTone?: FormGroupLabelTone;

  /**
   * Hides the label visually while keeping it available to screen readers.
   */
  srOnly?: boolean;

  /**
   * Additional Tailwind classes on the outer wrapper.
   */
  className?: string;

  /**
   * Extra classes on the label element (associated and checkboxAdjacent layouts).
   */
  labelClassName?: string;

  /**
   * When false, omits the default border and padding on stacked, checkbox, and
   * inline layouts for fields nested inside an already-bordered section.
   */
  bordered?: boolean;
}

/**
 * Returns Tailwind classes for the label text based on tone and visibility.
 *
 * @returns Class string for the label element.
 */
/**
 * Returns wrapper classes for bordered stacked, checkbox, and inline layouts.
 *
 * @param bordered - Whether the default border and padding should be applied.
 * @param layoutClasses - Layout-specific flex and sizing classes.
 * @param extra - Caller-supplied className override.
 */
function borderedWrapperClasses(bordered: boolean, layoutClasses: string, extra: string): string {
  const frame = bordered ? 'p-4 border border-separator rounded-md' : '';
  const base = `hc-form-group ${layoutClasses} ${frame}`.trim();
  return extra ? `${base} ${extra}` : base;
}

/**
 * Returns Tailwind classes for the label text based on tone and visibility.
 *
 * @returns Class string for the label element.
 */
function labelClasses(tone: FormGroupLabelTone, srOnly: boolean, inline: boolean): string {
  const base = 'hc-form-group-label text-[18px]';
  const visibility = srOnly ? 'sr-only' : '';
  if (inline) {
    const color = tone === 'muted' ? 'shrink-0 text-muted' : 'shrink-0 font-medium text-text';
    return `${base} ${color} ${visibility}`.trim();
  }
  const color = tone === 'muted' ? 'text-muted' : 'font-medium text-text';
  return `${base} ${color} ${visibility}`.trim();
}

/**
 * Reusable form field wrapper that pairs a label with one or more controls.
 * Supports stacked fields, checkboxes, inline rows, radio options, and
 * adjacent checkbox rows used in list pickers.
 */
export function FormGroup({
  label,
  children,
  htmlFor,
  description,
  error,
  errorId,
  descriptionId,
  layout = 'stacked',
  labelTone = 'default',
  srOnly = false,
  className,
  labelClassName,
  bordered = true,
  ...props
}: Props): JSX.Element {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const extra = className ?? '';

  if (layout === 'associated') {
    const associatedClasses = labelClassName
      ? `hc-form-group ${labelClassName}`
      : 'hc-form-group text-text';
    return (
      <label htmlFor={htmlFor} className={associatedClasses}>
        {label}
      </label>
    );
  }

  if (layout === 'checkboxAdjacent') {
    const wrapperClasses = extra
      ? `hc-form-group flex items-start gap-2 ${extra}`
      : 'hc-form-group flex items-start gap-2';
    const adjacentLabelClasses = labelClassName
      ? `hc-form-group-label ${labelClassName}`
      : 'hc-form-group-label min-w-0 flex-1 text-text';
    const linkedChildren = enhanceControl(children, { id: controlId });
    return (
      <div {...props} className={wrapperClasses}>
        {linkedChildren}
        <label htmlFor={controlId} className={adjacentLabelClasses}>
          {label}
        </label>
      </div>
    );
  }

  if (layout === 'radio') {
    const wrapperClasses = extra
      ? `hc-form-group inline-flex cursor-pointer items-center gap-1.5 text-text app-no-drag ${extra}`
      : 'hc-form-group inline-flex cursor-pointer items-center gap-1.5 text-text app-no-drag';
    const linkedChildren = enhanceControl(children, { id: controlId });
    return (
      <label htmlFor={controlId} className={wrapperClasses}>
        {linkedChildren}
        <span className="hc-form-group-label">{label}</span>
      </label>
    );
  }

  if (layout === 'checkbox') {
    const resolvedDescriptionId =
      description != null && description !== ''
        ? (descriptionId ?? (htmlFor ? `${htmlFor}-description` : undefined))
        : undefined;
    const resolvedErrorId =
      error != null && error !== ''
        ? (errorId ?? (htmlFor ? `${htmlFor}-error` : undefined))
        : undefined;
    const describedByIds = [resolvedDescriptionId, resolvedErrorId].filter(
      (id): id is string => id != null
    );
    const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined;
    const linkedChildren = enhanceControl(children, {
      describedBy,
      id: controlId,
      invalid: resolvedErrorId != null
    });
    const wrapperClasses = borderedWrapperClasses(bordered, 'flex flex-col gap-1', extra);
    return (
      <div {...props} className={wrapperClasses}>
        <label htmlFor={controlId} className="hc-form-group-label flex flex-col gap-1">
          <span className="hc-form-group-label-row flex items-center gap-2">
            {linkedChildren}
            <span className={labelClasses(labelTone, srOnly, false)}>{label}</span>
          </span>
          {resolvedDescriptionId ? (
            <p
              id={resolvedDescriptionId}
              className="hc-form-group-description m-0 pl-[26px] text-[14px] text-muted"
            >
              {description}
            </p>
          ) : null}
        </label>
        {resolvedErrorId ? (
          <FieldError id={resolvedErrorId} spacing="field">
            {error}
          </FieldError>
        ) : null}
      </div>
    );
  }

  if (layout === 'inline') {
    const wrapperClasses = borderedWrapperClasses(
      bordered,
      'flex min-w-0 flex-1 items-center gap-2',
      extra
    );
    const linkedChildren = enhanceControl(children, { id: controlId });
    return (
      <label htmlFor={controlId} className={wrapperClasses}>
        <span className={labelClasses(labelTone, srOnly, true)}>{label}</span>
        {linkedChildren}
      </label>
    );
  }

  const resolvedDescriptionId =
    description != null && description !== ''
      ? (descriptionId ?? (htmlFor ? `${htmlFor}-description` : undefined))
      : undefined;
  const resolvedErrorId =
    error != null && error !== ''
      ? (errorId ?? (htmlFor ? `${htmlFor}-error` : undefined))
      : undefined;
  const describedByIds = [resolvedDescriptionId, resolvedErrorId].filter(
    (id): id is string => id != null
  );
  const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined;
  const control = enhanceControl(children, {
    describedBy,
    invalid: resolvedErrorId != null,
    id: htmlFor
  });
  const wrapperClasses = borderedWrapperClasses(bordered, 'flex flex-col gap-1', extra);

  return (
    <div {...props} className={wrapperClasses}>
      <label htmlFor={htmlFor} className="hc-form-group-label flex flex-col gap-1">
        <span className={labelClasses(labelTone, srOnly, false)}>{label}</span>
        {resolvedDescriptionId ? (
          <p
            id={resolvedDescriptionId}
            className="hc-form-group-description m-0 text-[14px] text-muted"
          >
            {description}
          </p>
        ) : null}
        {control}
      </label>
      {resolvedErrorId ? (
        <FieldError id={resolvedErrorId} spacing="field">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}
