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
 * Proxy enabled toggle backed by the shared settings draft.
 */
export function ProxyEnabledField(): JSX.Element {
  const dispatch = useAppDispatch();
  const proxy = useAppSelector(selectDraftProxy);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="proxy.enabled" layout="checkbox">
      <Checkbox
        checked={proxy.enabled}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftProxyField({ key: 'enabled', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
