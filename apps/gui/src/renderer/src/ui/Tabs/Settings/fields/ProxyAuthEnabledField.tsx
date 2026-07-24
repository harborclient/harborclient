import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftProxy,
  selectSettingsDraftDisabled,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Proxy basic authentication toggle backed by the shared settings draft.
 */
export function ProxyAuthEnabledField(): JSX.Element {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled;

  return (
    <SettingField settingId="proxy.authEnabled" layout="checkbox">
      <Checkbox
        checked={proxy.authEnabled}
        disabled={fieldsDisabled}
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'authEnabled', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
