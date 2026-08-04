import { Modal } from '@harborclient/sdk/components';
import { ShortcutRunnerGame, type ShortcutLevel } from '@harborclient/shortcut-runner-game';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeShortcutTutorModal,
  selectShortcutTutorModal
} from '#/renderer/src/store/slices/modalsSlice';
import { buildShortcutTutorLevels } from './shortcutTutorLevels';

/**
 * Dialog hosting the Shortcut Runner training game at its default 600×500 size.
 *
 * Loads the user's current shortcut bindings for progressive levels and pauses
 * global shortcut capture while open so chords reach the game instead of the app.
 */
export function ShortcutTutorModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const shortcutTutor = useAppSelector(selectShortcutTutorModal);
  const [levels, setLevels] = useState<ShortcutLevel[] | null>(null);

  /**
   * Closes the tutor, clears loaded levels, and restores global shortcut capture.
   */
  const handleClose = useCallback((): void => {
    setLevels(null);
    dispatch(closeShortcutTutorModal());
  }, [dispatch]);

  /**
   * Pauses app shortcut capture while the dialog is open and resumes on close.
   */
  useEffect(() => {
    if (!shortcutTutor.open) {
      return;
    }

    void window.api.setShortcutCapturePaused(true);

    return () => {
      void window.api.setShortcutCapturePaused(false);
    };
  }, [shortcutTutor.open]);

  /**
   * Loads resolved shortcut bindings and builds the four tutor levels when opened.
   */
  useEffect(() => {
    if (!shortcutTutor.open) {
      return;
    }

    let cancelled = false;

    void window.api
      .getShortcuts()
      .then((bindings) => {
        if (cancelled) {
          return;
        }
        setLevels(buildShortcutTutorLevels(bindings, window.platform));
      })
      .catch(() => {
        if (!cancelled) {
          setLevels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shortcutTutor.open]);

  if (!shortcutTutor.open) {
    return null;
  }

  const hasPlayableLevels =
    levels != null &&
    levels.length > 0 &&
    levels.some((level) => Object.keys(level.shortcodes).length > 0);

  return (
    <Modal
      onClose={handleClose}
      className="w-[min(40.5rem,calc(100vw-2rem))]"
      labelledBy="shortcut-tutor-modal-title"
      title="Shortcut Tutor"
      description="Practice HarborClient shortcuts before the cactus reaches the runner."
    >
      {levels == null ? (
        <p className="m-0 text-muted" role="status">
          Loading shortcuts…
        </p>
      ) : !hasPlayableLevels ? (
        <p className="m-0 text-danger" role="alert">
          No shortcuts are available to practice.
        </p>
      ) : (
        <div className="flex justify-center">
          <ShortcutRunnerGame levels={levels} width={600} height={500} />
        </div>
      )}
    </Modal>
  );
}
