import { Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { ProxySettings } from '#/shared/types';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftProxy,
  selectSettingsDraftDisabled,
  setDraftProxyField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { PROXY_PROTOCOL_OPTIONS } from '../constants';
import { SettingField } from '../components/SettingField';

/**
 * Proxy protocol field backed by the shared settings draft.
 */
export function ProxyProtocolField(): JSX.Element {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const fieldsDisabled = disabled || !proxy.enabled;

  return (
    <SettingField settingId="proxy.protocol">
      <Select
        value={proxy.protocol}
        disabled={fieldsDisabled}
        onChange={(event) =>
          dispatch(
            setDraftProxyField({
              key: 'protocol',
              value: event.target.value as ProxySettings['protocol']
            })
          )
        }
      >
        {PROXY_PROTOCOL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </SettingField>
  );
}
