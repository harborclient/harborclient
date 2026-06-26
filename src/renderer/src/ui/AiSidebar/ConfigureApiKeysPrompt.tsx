import type { JSX } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openSettings } from '#/renderer/src/store/slices/navigationSlice';
import { EmptyState } from '#/renderer/src/components/EmptyState';

/**
 * Prompt shown when the AI sidebar is open but no provider API keys are configured.
 */
export function ConfigureApiKeysPrompt(): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Opens application settings on the AI section so the user can add API keys.
   */
  const handleOpenAiSettings = (): void => {
    dispatch(openSettings('ai'));
  };

  return (
    <EmptyState variant="centered">
      <p className="m-0">
        Configure API keys to use AI features.{' '}
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-[14px] text-accent hover:underline app-no-drag"
          onClick={handleOpenAiSettings}
        >
          Open AI settings
        </button>
      </p>
    </EmptyState>
  );
}
