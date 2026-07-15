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
 * Script network permission field backed by the shared settings draft.
 */
export function GeneralAllowScriptNetworkRequestsField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.allowScriptNetworkRequests" layout="checkbox">
      <Checkbox
        checked={general.allowScriptNetworkRequests}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'allowScriptNetworkRequests',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
