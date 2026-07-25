import { AutocompleteInput } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { useUserAgentAutocompleteSource } from '#/renderer/src/ui/Shared/UserAgentField/useUserAgentAutocompleteSource';
import { SettingField } from '../components/SettingField';
import { settingAnchorId } from '../settingAnchorId';

/**
 * Global default User-Agent field backed by the shared settings draft.
 */
export function GeneralUserAgentField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const source = useUserAgentAutocompleteSource();
  const controlId = settingAnchorId('general.userAgent');

  return (
    <SettingField settingId="general.userAgent" htmlFor={controlId}>
      <AutocompleteInput
        id={controlId}
        value={general.userAgent}
        disabled={disabled}
        source={source}
        onChange={(value) => dispatch(setDraftGeneralField({ key: 'userAgent', value }))}
        aria-label="User-Agent"
      />
    </SettingField>
  );
}
