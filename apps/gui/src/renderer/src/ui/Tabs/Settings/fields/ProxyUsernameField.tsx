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
 * Proxy username field backed by the shared settings draft.
 */
export function ProxyUsernameField(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled || !proxy.authEnabled;

  if (!proxy.authEnabled) {
    return null;
  }

  return (
    <SettingField settingId="proxy.username">
      <Input
        type="text"
        value={proxy.username}
        disabled={fieldsDisabled}
        autoComplete="off"
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'username', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
