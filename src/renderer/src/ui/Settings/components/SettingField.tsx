import { FormGroup } from '@harborclient/sdk/components';
import type { ComponentProps, JSX, ReactNode } from 'react';

import { entryById, type FieldSettingId } from '../catalog/catalog';
import { SettingLabel } from './SettingLabel';

type FormGroupProps = ComponentProps<typeof FormGroup>;

interface Props {
  /**
   * Catalog setting id used for labels, descriptions, and tooltips.
   */
  settingId: FieldSettingId;
  /**
   * Form control rendered inside the field wrapper.
   */
  children: ReactNode;
  /**
   * Associates the label with a control via `htmlFor`.
   */
  htmlFor?: string;
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
}

/**
 * Builds a stable DOM id for a catalog setting control.
 *
 * @param settingId - Catalog field id.
 */
function settingControlId(settingId: FieldSettingId): string {
  return `setting-${settingId.replaceAll('.', '-')}`;
}

/**
 * Builds a stable DOM id for a catalog setting description element.
 *
 * @param settingId - Catalog field id.
 */
function settingDescriptionId(settingId: FieldSettingId): string {
  return `${settingControlId(settingId)}-description`;
}

/**
 * Catalog-backed form field wrapper that injects setting metadata and id tooltips.
 */
export function SettingField({
  settingId,
  children,
  htmlFor,
  error,
  errorId,
  layout,
  labelTone,
  className
}: Props): JSX.Element {
  const entry = entryById(settingId);
  if (entry.kind !== 'field') {
    throw new Error(`SettingField requires a field entry: ${settingId}`);
  }

  const controlId = htmlFor ?? settingControlId(settingId);
  const descriptionId = settingDescriptionId(settingId);
  const description = entry.description;

  return (
    <div className="hc-setting-field">
      <FormGroup
        label={<SettingLabel settingId={settingId}>{entry.label}</SettingLabel>}
        description={description}
        descriptionId={description.length > 0 ? descriptionId : undefined}
        htmlFor={controlId}
        error={error}
        errorId={errorId}
        layout={layout}
        labelTone={labelTone}
        className={className}
      >
        {children}
      </FormGroup>
    </div>
  );
}
