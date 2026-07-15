import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftAi,
  selectSettingsDraftDisabled,
  setDraftAiField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Google Gemini API key field backed by the shared settings draft.
 */
export function AiGeminiApiKeyField(): JSX.Element {
  const dispatch = useAppDispatch();
  const ai = useAppSelector(selectDraftAi);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="ai.geminiApiKey" htmlFor="ai-gemini-api-key">
      <Input
        id="ai-gemini-api-key"
        type="password"
        value={ai.geminiApiKey}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) =>
          dispatch(setDraftAiField({ key: 'geminiApiKey', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
