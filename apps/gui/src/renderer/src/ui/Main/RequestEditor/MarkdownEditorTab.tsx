import { Button } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Variable } from '#/shared/types';
import { acceleratorMatchesChord, getShortcutDef, type KeyChord } from '#/shared/shortcuts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectDocumentsByCollection } from '#/renderer/src/store/selectors';
import { updateMarkdownContent } from '#/renderer/src/store/slices/tabsSlice';
import { saveMarkdownTab } from '#/renderer/src/store/thunks/documents';
import { isTabDirty, type MarkdownTab } from '#/renderer/src/store/tabs';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { CommentEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/CommentEditor';
import { useSidebarModals } from '#/renderer/src/ui/Sidebars/CollectionSidebar/modals/sidebarModalsContext';

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
  const { openRenameDocument } = useSidebarModals();
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty = isTabDirty(tab);
  const [saveAccelerator, setSaveAccelerator] = useState(
    () => getShortcutDef('save')?.defaultAccelerator ?? 'CmdOrCtrl+S'
  );

  /**
   * Resolves the persisted document for rename and copy-to-chat references.
   */
  const document = useMemo(() => {
    return (documentsByCollection[tab.collectionId] ?? []).find((entry) => entry.id === tab.docId);
  }, [documentsByCollection, tab.collectionId, tab.docId]);

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
   * Copies the current markdown source (including unsaved edits) to the clipboard.
   */
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(tab.content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [tab.content]);

  /**
   * Opens the shared rename-document modal for the active tab's document.
   */
  const handleRename = useCallback((): void => {
    if (document == null) {
      return;
    }
    openRenameDocument(document);
  }, [document, openRenameDocument]);

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

  /**
   * Resolves the persisted document uuid used by copy-to-chat `@markdown` references.
   */
  const markdownReference = useMemo(() => {
    if (document == null) {
      return undefined;
    }

    return {
      uuid: document.uuid,
      label: `Document: ${tab.name}`
    };
  }, [document, tab.name]);

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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-label="Copy markdown to clipboard"
              onClick={() => void handleCopy()}
            >
              Copy
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={document == null}
              onClick={handleRename}
            >
              Rename
            </Button>
            <Button type="button" disabled={!dirty || saving} onClick={() => void persistTab()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
        markdownReference={markdownReference}
      />
    </div>
  );
}
