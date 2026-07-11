import { Button, Checkbox, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import { unloadAllPlugins } from '#/renderer/src/plugins/pluginLoader';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectQuitPrompt, setQuitPrompt } from '#/renderer/src/store/slices/modalsSlice';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import type { AppDispatch } from '#/renderer/src/store/redux';

const QUIT_PROMPT_CHECKBOX_ID = 'quit-prompt-dont-ask-again';

interface QuitPromptContentProps {
  /** Dirty tab names shown in the quit confirmation message. */
  dirtyTabNames: string[];
  /** Redux dispatch for modal actions. */
  dispatch: AppDispatch;
}

/**
 * Renders one quit prompt instance; remounting resets the optional checkbox state.
 */
function QuitPromptContent({ dirtyTabNames, dispatch }: QuitPromptContentProps): JSX.Element {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  /**
   * Dismisses the quit prompt and tells main whether to proceed with app close.
   */
  const handleCancel = useCallback((): void => {
    dispatch(setQuitPrompt(null));
    window.api.confirmClose(false);
  }, [dispatch]);

  /**
   * Confirms quit without saving, optionally suppressing future quit prompts, and closes the app.
   */
  const handleConfirm = useCallback((): void => {
    dispatch(setQuitPrompt(null));

    const proceed = (): void => {
      void unloadAllPlugins().finally(() => {
        window.api.confirmClose(true);
      });
    };

    if (dontAskAgain) {
      void dispatch(patchGeneralSettings({ warnWhenExitingWithUnsavedChanges: false })).finally(
        proceed
      );
      return;
    }

    proceed();
  }, [dispatch, dontAskAgain]);

  return (
    <Modal onClose={handleCancel} labelledBy="quit-prompt-title" title="Unsaved changes">
      <p className="mb-4 text-[16px] text-muted">
        {dirtyTabNames.length === 1 ? (
          <>&ldquo;{dirtyTabNames[0]}&rdquo; has unsaved changes. Quit without saving?</>
        ) : (
          <>{dirtyTabNames.length} requests have unsaved changes. Quit without saving?</>
        )}
      </p>
      <div className="mb-4 flex items-center gap-2">
        <Checkbox
          id={QUIT_PROMPT_CHECKBOX_ID}
          checked={dontAskAgain}
          onChange={(event) => setDontAskAgain(event.target.checked)}
        />
        <label htmlFor={QUIT_PROMPT_CHECKBOX_ID} className="text-[16px] text-muted">
          Don&apos;t show this again
        </label>
      </div>
      <ModalFooter>
        <Button onClick={handleConfirm}>Quit without saving</Button>
      </ModalFooter>
    </Modal>
  );
}

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
