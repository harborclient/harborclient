import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Request timeout field backed by the shared settings draft.
 */
export function GeneralRequestTimeoutField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.requestTimeoutMs">
      <Input
        type="number"
        min={0}
        value={general.requestTimeoutMs}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'requestTimeoutMs',
              value: Number(event.target.value)
            })
          )
        }
      />
    </SettingField>
  );
}
