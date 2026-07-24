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
 * Claude API key field backed by the shared settings draft.
 */
export function AiClaudeApiKeyField(): JSX.Element {
  const dispatch = useAppDispatch();
  const ai = useAppSelector(selectDraftAi);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="ai.claudeApiKey" htmlFor="ai-claude-api-key">
      <Input
        id="ai-claude-api-key"
        type="password"
        value={ai.claudeApiKey}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) =>
          dispatch(setDraftAiField({ key: 'claudeApiKey', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
