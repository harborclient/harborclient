import { Button } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { acceleratorMatchesChord, getShortcutDef, type KeyChord } from '#/shared/shortcuts';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { updateMarkdownContent } from '#/renderer/src/store/slices/tabsSlice';
import { saveMarkdownTab } from '#/renderer/src/store/thunks/documents';
import { isTabDirty, type MarkdownTab } from '#/renderer/src/store/drafts';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { CommentEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/CommentEditor';

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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty = isTabDirty(tab);
  const [saveAccelerator, setSaveAccelerator] = useState(
    () => getShortcutDef('save')?.defaultAccelerator ?? 'CmdOrCtrl+S'
  );

  /**
   * Loads the effective save shortcut from user settings.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getShortcuts().then((bindings) => {
      if (cancelled) {
        return;
      }

      const saveBinding = bindings.find((binding) => binding.id === 'save');
      if (saveBinding != null) {
        setSaveAccelerator(saveBinding.accelerator);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persists the current markdown tab content to storage.
   */
  const persistTab = useCallback(async (): Promise<void> => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await dispatch(saveMarkdownTab(tab.tabId)).unwrap();
    } catch (err: unknown) {
      showAlert(dispatch, formatErrorMessage(err, 'Failed to save document'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [dispatch, tab.tabId]);

  /**
   * Wires the configured save shortcut while this tab is active and has unsaved changes.
   */
  useEffect(() => {
    /**
     * Saves when the configured save shortcut is pressed and the tab is dirty.
     *
     * @param event - Keydown event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!acceleratorMatchesChord(saveAccelerator, chordFromKeyboardEvent(event))) {
        return;
      }

      if (!dirty || savingRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void persistTab();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dirty, persistTab, saveAccelerator]);

  /**
   * Updates tab state when markdown changes.
   *
   * @param content - Updated markdown body.
   */
  const handleChange = useCallback(
    (content: string): void => {
      dispatch(updateMarkdownContent({ tabId: tab.tabId, content }));
    },
    [dispatch, tab.tabId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <CommentEditor
        value={tab.content}
        onChange={handleChange}
        variables={variables}
        onEditVariables={onEditVariables}
        enableFormatDocument
        label={tab.name}
        description="Edit the markdown document."
        actions={
          <Button type="button" disabled={!dirty || saving} onClick={() => void persistTab()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />
    </div>
  );
}
