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
 * OpenAI API key field backed by the shared settings draft.
 */
export function AiOpenAiApiKeyField(): JSX.Element {
  const dispatch = useAppDispatch();
  const ai = useAppSelector(selectDraftAi);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="ai.openaiApiKey" htmlFor="ai-openai-api-key">
      <Input
        id="ai-openai-api-key"
        type="password"
        value={ai.openaiApiKey}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) =>
          dispatch(setDraftAiField({ key: 'openaiApiKey', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
