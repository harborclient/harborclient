import type { AutocompleteSource } from '@harborclient/sdk/components';
import { useMemo } from 'react';
import { appendCustomUserAgent, listUserAgentPresets } from '@harborclient/core/userAgent';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setDraftGeneralField } from '#/renderer/src/store/slices/settingsDraftSlice';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';

/**
 * Builds an autocomplete source for User-Agent presets and custom entries.
 *
 * Built-ins come from core; customs are read from general settings. Committing a
 * new value immediately patches `customUserAgents` so every control shares the list,
 * and mirrors the value into the settings draft so a later Settings save cannot
 * overwrite newly added customs.
 *
 * @returns Autocomplete source for SDK AutocompleteInput.
 */
export function useUserAgentAutocompleteSource(): AutocompleteSource {
  const dispatch = useAppDispatch();
  const customUserAgents = useAppSelector((state) => state.settings.general.customUserAgents);

  return useMemo((): AutocompleteSource => {
    return {
      list: async () => listUserAgentPresets(customUserAgents),
      add: async (candidate) => {
        const next = appendCustomUserAgent(customUserAgents, candidate);
        if (next.length === customUserAgents.length) {
          return;
        }
        await dispatch(patchGeneralSettings({ customUserAgents: next }));
        dispatch(setDraftGeneralField({ key: 'customUserAgents', value: next }));
      }
    };
  }, [customUserAgents, dispatch]);
}
