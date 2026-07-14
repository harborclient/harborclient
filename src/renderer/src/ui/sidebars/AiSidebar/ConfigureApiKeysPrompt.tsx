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

  /**
   * Opens the Team Hub page so the user can connect to a hub with LLM access.
   */
  const handleOpenTeamHubs = (): void => {
    dispatch(openPageTab({ type: 'team-hubs' }));
  };

  return (
    <EmptyState variant="centered">
      <p className="m-0">
        Configure personal API keys or connect to a Team Hub with LLM access to use AI features.{' '}
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-[14px] text-accent hover:underline app-no-drag"
          onClick={handleOpenAiSettings}
        >
          Open AI settings
        </button>{' '}
        or{' '}
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-[14px] text-accent hover:underline app-no-drag"
          onClick={handleOpenTeamHubs}
        >
          connect a Team Hub
        </button>
        .
      </p>
      <Button type="button" className="mt-4" onClick={handleOpenAiSettings}>
        Settings
      </Button>
    </EmptyState>
  );
}
