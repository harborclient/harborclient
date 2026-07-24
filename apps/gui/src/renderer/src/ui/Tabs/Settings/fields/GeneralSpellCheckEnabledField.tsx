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
 * Spell-check field backed by the shared settings draft.
 */
export function GeneralSpellCheckEnabledField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.spellCheckEnabled" layout="checkbox">
      <Checkbox
        checked={general.spellCheckEnabled}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftGeneralField({ key: 'spellCheckEnabled', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
