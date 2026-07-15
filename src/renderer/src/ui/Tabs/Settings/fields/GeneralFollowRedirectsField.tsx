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
 * Follow redirects field backed by the shared settings draft.
 */
export function GeneralFollowRedirectsField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="general.followRedirects" layout="checkbox">
      <Checkbox
        checked={general.followRedirects}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftGeneralField({ key: 'followRedirects', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
