import { FormGroup, SettingFieldActions, SettingIdLabel } from '@harborclient/sdk/components';
import type { ComponentProps, JSX, ReactNode } from 'react';

import { entryById, type GroupSettingId } from '../catalog/catalog';
import { useSettingFieldState } from '../hooks/useSettingFieldState';
import { settingAnchorId } from '../settingAnchorId';

type FormGroupProps = ComponentProps<typeof FormGroup>;

interface Props {
  /**
   * Catalog group setting id (e.g. `git.autoTrack`).
   */
  settingId: GroupSettingId;
  /**
   * Form control or table rendered inside the group wrapper.
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
 * Catalog-backed settings group wrapper that injects group metadata, id tooltips,
 * a modified accent border, and a per-setting cog menu (reset / copy).
 *
 * Used for group catalog entries (`kind: 'group'`) that are not part of
 * `SETTINGS_FIELD_REGISTRY`, such as git draft groups and backup confirmations.
 */
export function SettingGroupField({
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
  if (entry.kind !== 'group') {
    throw new Error(`SettingGroupField requires a group entry: ${settingId}`);
  }

  const { isModified, resetToDefault, copySettingId, copySettingAsJson, copyDeepLink } =
    useSettingFieldState(settingId);
  const controlId = htmlFor ?? settingAnchorId(settingId);
  const descriptionId = `${controlId}-description`;
  const description = entry.description;

  /**
   * Label row with cog actions beside the setting id label.
   */
  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <SettingFieldActions
        settingId={settingId}
        isModified={isModified}
        onReset={resetToDefault}
        onCopyId={() => void copySettingId()}
        onCopyJson={() => void copySettingAsJson()}
        onCopyDeepLink={() => void copyDeepLink()}
      />
      <SettingIdLabel settingId={settingId}>{entry.label}</SettingIdLabel>
    </span>
  );

  return (
    <div className="hc-setting-field group/setting-field">
      <FormGroup
        label={label}
        description={description}
        descriptionId={description.length > 0 ? descriptionId : undefined}
        htmlFor={controlId}
        error={error}
        errorId={errorId}
        layout={layout}
        labelTone={labelTone}
        className={className}
        modified={isModified}
      >
        {children}
      </FormGroup>
    </div>
  );
}
