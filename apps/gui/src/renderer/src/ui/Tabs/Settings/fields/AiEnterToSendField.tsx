import { Checkbox } from '@harborclient/sdk/components';
import { useEffect, type JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectEnterToSend, setEnterToSend } from '#/renderer/src/store/slices/aiChatSlice';
import { updateEnterToSend } from '#/renderer/src/store/thunks/aiChat';
import { SettingField } from '../components/SettingField';

/**
 * Enter-to-send toggle for the AI chat composer.
 *
 * Persists immediately via the AI chat session store (not the settings draft).
 */
export function AiEnterToSendField(): JSX.Element {
  const dispatch = useAppDispatch();
  const enterToSend = useAppSelector(selectEnterToSend);

  /**
   * Loads the persisted preference when Settings opens before the AI sidebar has
   * hydrated chat session state.
   */
  useEffect(() => {
    let cancelled = false;
    void window.api.getAiChatSession().then((session) => {
      if (!cancelled) {
        dispatch(setEnterToSend(session.enterToSend));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <SettingField settingId="ai.enterToSend" layout="checkbox">
      <Checkbox
        checked={enterToSend}
        onChange={(event) => {
          void dispatch(updateEnterToSend(event.target.checked));
        }}
      />
    </SettingField>
  );
}
