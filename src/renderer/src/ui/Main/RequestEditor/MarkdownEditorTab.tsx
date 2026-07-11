import { useCallback, useEffect, useRef, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { acceleratorMatchesChord, getShortcutDef, type KeyChord } from '#/shared/shortcuts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { updateMarkdownContent } from '#/renderer/src/store/slices/tabsSlice';
import { saveMarkdownTab } from '#/renderer/src/store/thunks/documents';
import type { MarkdownTab } from '#/renderer/src/store/drafts';
import { CommentEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/CommentEditor';

/** Debounce window for autosaving markdown document edits. */
const AUTOSAVE_DEBOUNCE_MS = 800;

interface Props {
  /**
   * Active markdown document tab to edit.
   */
  tab: MarkdownTab;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Builds a normalized keyboard chord from a browser keydown event.
 *
 * @param event - Keydown event from the markdown editor surface.
 * @returns Chord suitable for shortcut matching.
 */
function chordFromKeyboardEvent(event: KeyboardEvent): KeyChord {
  return {
    key: event.key,
    control: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey
  };
}

/**
 * Full-height markdown editor tab for collection documents.
 */
export function MarkdownEditorTab({ tab, variables, onEditVariables }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  /**
   * Persists the current markdown tab content to storage.
   */
  const persistTab = useCallback(async (): Promise<void> => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    try {
      await dispatch(saveMarkdownTab(tab.tabId)).unwrap();
    } finally {
      savingRef.current = false;
    }
  }, [dispatch, tab.tabId]);

  /**
   * Schedules a debounced autosave after the user stops typing.
   */
  const scheduleAutosave = useCallback((): void => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistTab();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [persistTab]);

  /**
   * Flushes any pending autosave timer when the tab unmounts.
   */
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  /**
   * Wires Ctrl+S / Cmd+S to an immediate save while this tab is active.
   */
  useEffect(() => {
    const saveAccelerator = getShortcutDef('save')?.defaultAccelerator ?? 'CmdOrCtrl+S';

    /**
     * Saves immediately when the configured save shortcut is pressed.
     *
     * @param event - Keydown event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!acceleratorMatchesChord(saveAccelerator, chordFromKeyboardEvent(event))) {
        return;
      }

      event.preventDefault();
      if (autosaveTimerRef.current != null) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      void persistTab();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [persistTab]);

  /**
   * Updates tab state and schedules autosave when markdown changes.
   *
   * @param content - Updated markdown body.
   */
  const handleChange = useCallback(
    (content: string): void => {
      dispatch(updateMarkdownContent({ tabId: tab.tabId, content }));
      scheduleAutosave();
    },
    [dispatch, scheduleAutosave, tab.tabId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <CommentEditor
        value={tab.content}
        onChange={handleChange}
        variables={variables}
        onEditVariables={onEditVariables}
        label={tab.name}
        description="Edit the markdown document. Changes autosave while you type."
      />
    </div>
  );
}
