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
 * Proxy host field backed by the shared settings draft.
 */
export function ProxyHostField(): JSX.Element {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled;

  return (
    <SettingField settingId="proxy.host">
      <Input
        type="text"
        value={proxy.host}
        disabled={fieldsDisabled}
        placeholder="proxy.example.com"
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'host', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
