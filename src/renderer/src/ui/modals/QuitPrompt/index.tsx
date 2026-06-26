import { useCallback, type JSX } from 'react';
import { unloadAllPlugins } from '#/renderer/src/plugins/pluginLoader';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectQuitPrompt, setQuitPrompt } from '#/renderer/src/store/slices/modalsSlice';
import { Button } from '#/renderer/src/components/Button';
import { Modal, ModalFooter } from '#/renderer/src/components/Modal';

/**
 * Confirms quitting when one or more request tabs have unsaved changes.
 */
export function QuitPrompt(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const quitPrompt = useAppSelector(selectQuitPrompt);

  /**
   * Dismisses the quit prompt and tells main whether to proceed with app close.
   */
  const handleCancel = useCallback((): void => {
    dispatch(setQuitPrompt(null));
    window.api.confirmClose(false);
  }, [dispatch]);

  /**
   * Confirms quit without saving and tells main to close the app.
   */
  const handleConfirm = useCallback((): void => {
    dispatch(setQuitPrompt(null));
    void unloadAllPlugins().finally(() => {
      window.api.confirmClose(true);
    });
  }, [dispatch]);

  if (!quitPrompt) return null;

  return (
    <Modal onClose={handleCancel} labelledBy="quit-prompt-title" title="Unsaved changes">
      <p className="mb-4 text-[14px] text-muted">
        {quitPrompt.length === 1 ? (
          <>&ldquo;{quitPrompt[0]}&rdquo; has unsaved changes. Quit without saving?</>
        ) : (
          <>{quitPrompt.length} requests have unsaved changes. Quit without saving?</>
        )}
      </p>
      <ModalFooter>
        <Button onClick={handleConfirm}>Quit without saving</Button>
      </ModalFooter>
    </Modal>
  );
}
