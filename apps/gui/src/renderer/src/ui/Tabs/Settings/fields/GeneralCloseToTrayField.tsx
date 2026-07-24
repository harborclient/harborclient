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
 * Close-to-tray field backed by the shared settings draft.
 */
export function GeneralCloseToTrayField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.closeToTray" layout="checkbox">
      <Checkbox
        checked={general.closeToTray}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftGeneralField({ key: 'closeToTray', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
