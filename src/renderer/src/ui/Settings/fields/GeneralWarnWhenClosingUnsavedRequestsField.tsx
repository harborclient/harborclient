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
 * Warn-when-closing-unsaved-requests field backed by the shared settings draft.
 */
export function GeneralWarnWhenClosingUnsavedRequestsField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.warnWhenClosingUnsavedRequests" layout="checkbox">
      <Checkbox
        checked={general.warnWhenClosingUnsavedRequests}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'warnWhenClosingUnsavedRequests',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
