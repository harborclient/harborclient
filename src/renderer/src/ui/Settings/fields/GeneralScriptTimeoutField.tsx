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
 * Pre/post script timeout field backed by the shared settings draft.
 */
export function GeneralScriptTimeoutField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.scriptTimeoutMs">
      <Input
        type="number"
        min={0}
        value={general.scriptTimeoutMs}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'scriptTimeoutMs',
              value: Number(event.target.value)
            })
          )
        }
      />
    </SettingField>
  );
}
