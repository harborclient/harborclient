import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Warn-when-exiting-with-unsaved-changes field backed by the shared settings draft.
 */
export function GeneralWarnWhenExitingWithUnsavedChangesField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.warnWhenExitingWithUnsavedChanges" layout="checkbox">
      <Checkbox
        checked={general.warnWhenExitingWithUnsavedChanges}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'warnWhenExitingWithUnsavedChanges',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
