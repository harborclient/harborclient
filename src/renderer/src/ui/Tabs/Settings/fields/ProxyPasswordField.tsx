import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftProxy,
  selectSettingsDraftDisabled,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Proxy password field backed by the shared settings draft.
 */
export function ProxyPasswordField(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled || !proxy.authEnabled;

  if (!proxy.authEnabled) {
    return null;
  }

  return (
    <SettingField settingId="proxy.password">
      <Input
        type="password"
        value={proxy.password}
        disabled={fieldsDisabled}
        autoComplete="off"
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'password', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
