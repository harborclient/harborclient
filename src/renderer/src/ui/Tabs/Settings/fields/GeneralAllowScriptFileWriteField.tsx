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
 * Script file-write permission field backed by the shared settings draft.
 */
export function GeneralAllowScriptFileWriteField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.allowScriptFileWrite" layout="checkbox">
      <Checkbox
        checked={general.allowScriptFileWrite}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftGeneralField({
              key: 'allowScriptFileWrite',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
