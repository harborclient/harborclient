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
 * Start webpage URL field backed by the shared settings draft.
 *
 * Controls the default address (and Home target) for newly opened Live Pages.
 */
export function GeneralStartWebpageUrlField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.startWebpageUrl">
      <Input
        type="text"
        value={general.startWebpageUrl}
        disabled={disabled}
        placeholder="about:blank"
        onChange={(event) =>
          dispatch(setDraftGeneralField({ key: 'startWebpageUrl', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
