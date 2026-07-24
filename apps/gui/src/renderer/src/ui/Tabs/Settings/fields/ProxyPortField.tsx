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
 * Proxy port field backed by the shared settings draft.
 */
export function ProxyPortField(): JSX.Element {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled;

  return (
    <SettingField settingId="proxy.port">
      <Input
        type="number"
        min={1}
        max={65535}
        value={proxy.port}
        disabled={fieldsDisabled}
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'port', value: Number(event.target.value) }))
        }
      />
    </SettingField>
  );
}
