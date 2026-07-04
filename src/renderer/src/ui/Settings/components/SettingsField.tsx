import { FormGroup } from '@harborclient/sdk/components';
import type { ComponentProps, JSX, ReactNode } from 'react';

type FormGroupProps = ComponentProps<typeof FormGroup>;

interface Props {
  /**
   * Visible field label text or custom label content.
   */
  label: ReactNode;
  /**
   * Form control rendered inside the field wrapper.
   */
  children: ReactNode;
  /**
   * Associates the label with a control via `htmlFor`.
   */
  htmlFor?: string;
  /**
   * Helper text rendered below the label and above the control.
   */
  description?: ReactNode;
  /**
   * Explicit id for the description element.
   */
  descriptionId?: string;
  /**
   * Validation error rendered below the control.
   */
  error?: ReactNode;
  /**
   * Explicit id for the error element.
   */
  errorId?: string;
  /**
   * Label and control placement preset.
   */
  layout?: FormGroupProps['layout'];
  /**
   * Label color style.
   */
  labelTone?: FormGroupProps['labelTone'];
  /**
   * Additional classes on the outer wrapper.
   */
  className?: string;
  /**
   * When true, strips FormGroup border and padding for fields nested inside an
   * already-bordered section.
   */
  embedded?: boolean;
}

/**
 * Shared labeled form field wrapper around SDK FormGroup.
 */
export function SettingsField({
  label,
  children,
  htmlFor,
  description,
  descriptionId,
  error,
  errorId,
  layout,
  labelTone,
  className,
  embedded = false
}: Props): JSX.Element {
  const embeddedClasses = embedded ? 'border-none! p-0!' : '';
  const mergedClassName = [embeddedClasses, className].filter(Boolean).join(' ') || undefined;

  return (
    <FormGroup
      label={label}
      description={description}
      descriptionId={descriptionId}
      htmlFor={htmlFor}
      error={error}
      errorId={errorId}
      layout={layout}
      labelTone={labelTone}
      className={mergedClassName}
    >
      {children}
    </FormGroup>
  );
}
