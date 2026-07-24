import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectQuitPrompt } from '#/renderer/src/store/slices/modalsSlice';
import { QuitPromptContent } from './QuitPromptContent';

/**
 * Confirms quitting when one or more request tabs have unsaved changes.
 */
export function QuitPrompt(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const quitPrompt = useAppSelector(selectQuitPrompt);

  if (!quitPrompt) return null;

  return (
    <QuitPromptContent key={quitPrompt.join('\0')} dirtyTabNames={quitPrompt} dispatch={dispatch} />
  );
}
