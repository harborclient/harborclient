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
 * Auto-hide scrollbars field backed by the shared settings draft.
 */
export function GeneralScrollbarAutoHideField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.scrollbarAutoHide" layout="checkbox">
      <Checkbox
        checked={general.scrollbarAutoHide}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftGeneralField({ key: 'scrollbarAutoHide', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
