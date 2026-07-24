import { Button, EmptyState } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Prompt shown when the AI sidebar is open but no personal API keys, Team Hub LLM
 * models, or GitHub Models connection are available.
 */
export function ConfigureApiKeysPrompt(): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Opens application settings on the AI section so the user can add API keys.
   */
  const handleOpenAiSettings = (): void => {
    dispatch(openPageTab({ type: 'settings', section: 'ai' }));
  };

  return (
    <EmptyState variant="centered">
      <p className="m-0 flex flex-col">
        No chat messages.
        <Button type="button" className="mt-4" onClick={handleOpenAiSettings}>
          Settings
        </Button>
      </p>
    </EmptyState>
  );
}
