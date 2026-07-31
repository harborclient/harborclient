import { CopyToChatButton } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setConsoleSelection } from '#/renderer/src/store/slices/consoleSelectionsSlice';
import {
  buildConsoleSelectionCopyPayload,
  captureConsoleSelection,
  CONSOLE_SELECTION_TOOLBAR_DELAY_MS,
  getConsoleSelectionToolbarCoords,
  isCopyToChatShortcutEvent,
  type ConsoleSelectionSnapshotMeta
} from './captureConsoleSelection';

interface Props {
  /**
   * Inspector content that hosts annotated console cells.
   */
  children: ReactNode;

  /**
   * Optional send metadata stored on the console-row snapshot.
   */
  meta?: ConsoleSelectionSnapshotMeta;

  /**
   * Optional class names for the selection host root.
   */
  className?: string;
}

/**
 * Wraps Console / Headers / Timing content with floating Copy to chat for cell selections.
 *
 * @param props - Host children and optional snapshot metadata.
 */
export function ConsoleSelectionHost({ children, meta, className }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const rootRef = useRef<HTMLDivElement>(null);
  const handleCopyRef = useRef<() => Promise<void>>(async () => undefined);
  const selectionToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [selectionToolbarCoords, setSelectionToolbarCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);

  /**
   * Hides the floating copy-to-chat toolbar.
   */
  const hideSelectionToolbar = useCallback((): void => {
    setSelectionToolbarVisible(false);
    setSelectionToolbarCoords(null);
  }, []);

  /**
   * Copies the current console cell selection into the AI composer.
   */
  const handleCopySelectionToChat = useCallback(async (): Promise<void> => {
    const root = rootRef.current;
    if (root == null || !aiAvailable) {
      return;
    }

    const capture = captureConsoleSelection(root);
    if (capture == null) {
      return;
    }

    const { token, snapshot } = buildConsoleSelectionCopyPayload(capture, meta);
    dispatch(setConsoleSelection({ token, snapshot }));
    await copyToChat(token);
    window.getSelection()?.removeAllRanges();
    hideSelectionToolbar();
  }, [aiAvailable, copyToChat, dispatch, hideSelectionToolbar, meta]);

  /**
   * Keeps the copy handler ref aligned for keyboard shortcut listeners.
   */
  useEffect(() => {
    handleCopyRef.current = handleCopySelectionToChat;
  }, [handleCopySelectionToChat]);

  /**
   * Shows or hides the copy-to-chat toolbar when the user selects annotated cell text.
   */
  useEffect(() => {
    if (!aiAvailable) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    /**
     * Debounces toolbar positioning until the selection settles.
     */
    const scheduleToolbarUpdate = (): void => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      const capture = captureConsoleSelection(root);
      if (capture == null) {
        hideSelectionToolbar();
        return;
      }

      selectionToolbarTimerRef.current = setTimeout(() => {
        selectionToolbarTimerRef.current = null;
        const coords = getConsoleSelectionToolbarCoords(root);
        if (coords == null) {
          hideSelectionToolbar();
          return;
        }

        setSelectionToolbarCoords(coords);
        setSelectionToolbarVisible(true);
      }, CONSOLE_SELECTION_TOOLBAR_DELAY_MS);
    };

    document.addEventListener('selectionchange', scheduleToolbarUpdate);
    root.addEventListener('mouseup', scheduleToolbarUpdate);
    root.addEventListener('keyup', scheduleToolbarUpdate);

    return () => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      document.removeEventListener('selectionchange', scheduleToolbarUpdate);
      root.removeEventListener('mouseup', scheduleToolbarUpdate);
      root.removeEventListener('keyup', scheduleToolbarUpdate);
      hideSelectionToolbar();
    };
  }, [aiAvailable, hideSelectionToolbar]);

  /**
   * Wires Ctrl+Shift+O to copy the current console cell selection to chat.
   */
  useEffect(() => {
    if (!aiAvailable) {
      return;
    }

    /**
     * Copies the current selection when the copy-to-chat shortcut is pressed.
     *
     * @param event - Keydown event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isCopyToChatShortcutEvent(event)) {
        return;
      }

      const root = rootRef.current;
      if (!root || captureConsoleSelection(root) == null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleCopyRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [aiAvailable]);

  const showSelectionToolbar =
    selectionToolbarVisible && selectionToolbarCoords != null && aiAvailable;

  return (
    <div ref={rootRef} className={className}>
      {children}
      {showSelectionToolbar ? (
        <CopyToChatButton
          coords={selectionToolbarCoords}
          aria-label="Copy console selection to chat"
          onSelect={() => {
            void handleCopySelectionToChat();
          }}
        />
      ) : null}
    </div>
  );
}
