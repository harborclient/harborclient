import { useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { MenuItem } from '@harborclient/sdk/components';
import type { ScriptRef, Snippet } from '@harborclient/core/types';
import { createInlineScriptRef, createSnippetScriptRef } from '@harborclient/core/scriptRefs';
import { buildSnippetBundle } from '@harborclient/core/snippetBundle';
import { snippetMatchesPhase, snippetScopeForPhase } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '@harborclient/core/scriptStage';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { createSnippet } from '#/renderer/src/store/thunks/snippets';
import { SnippetEditModal } from '#/renderer/src/ui/Shared/Snippet/SnippetEditModal';
import {
  createBlankSnippet,
  createImportedSnippetDraft,
  type SnippetEditDraft
} from '#/renderer/src/ui/Shared/Snippet/snippetEditDraft';

interface Options {
  /**
   * Script phase used for snippet scope filtering and create defaults.
   */
  phase: 'pre' | 'post';

  /**
   * Snippet library entries for the picker menu.
   */
  snippets: Snippet[];

  /**
   * Current script list used when exporting a snippets bundle.
   */
  scripts: ScriptRef[];

  /**
   * Appends a script reference created from a library snippet or new snippet.
   *
   * @param script - Normalized script ref with `expanded: true` when appropriate.
   */
  onAddScript: (script: ScriptRef) => void;

  /**
   * Appends inline script refs imported from a snippets bundle JSON file.
   *
   * @param scripts - Inline refs built from each bundle entry.
   */
  onImportScripts: (scripts: ScriptRef[]) => void;
}

interface Result {
  /**
   * Grouped menu entries for the Snippets toolbar / section submenu.
   */
  snippetMenuGroups: MenuItem[][];

  /**
   * Opens the create-snippet modal with a blank draft.
   *
   * @param phaseOverride - Optional phase for the draft scope; defaults to `options.phase`.
   */
  openCreateSnippetModal: (phaseOverride?: 'pre' | 'post') => void;

  /**
   * Imports a `.js` file or snippets bundle into the script list / create modal.
   */
  handleImportSnippet: () => Promise<void>;

  /**
   * Exports the current script list as a snippets bundle JSON file.
   */
  handleExportSnippets: () => Promise<void>;

  /**
   * Create-snippet modal element, or null when closed.
   */
  createSnippetModal: JSX.Element | null;
}

/**
 * Shared snippet library actions for script list editors.
 *
 * Owns create-snippet modal state plus import/export and the Snippets menu
 * groups so request-script and live-server editors can reuse the same flows
 * without duplicating modal wiring.
 *
 * @param options - Phase, library, export source, and add/import callbacks.
 * @returns Menu groups, import/export handlers, and the create modal element.
 */
export function useScriptSnippetActions(options: Options): Result {
  const { phase, snippets, scripts, onAddScript, onImportScripts } = options;
  const dispatch = useAppDispatch();
  const [createSnippetDraft, setCreateSnippetDraft] = useState<SnippetEditDraft | null>(null);
  const [createSnippetSaving, setCreateSnippetSaving] = useState(false);
  const [createSnippetError, setCreateSnippetError] = useState<string | null>(null);

  /**
   * Opens the create-snippet modal from the snippet library menu.
   *
   * @param phaseOverride - Optional phase for the draft scope; defaults to `phase`.
   */
  const openCreateSnippetModal = useCallback(
    (phaseOverride?: 'pre' | 'post'): void => {
      setCreateSnippetDraft(createBlankSnippet(snippetScopeForPhase(phaseOverride ?? phase)));
      setCreateSnippetError(null);
    },
    [phase]
  );

  /**
   * Closes the create-snippet modal and clears transient error state.
   */
  const closeCreateSnippetModal = useCallback((): void => {
    setCreateSnippetDraft(null);
    setCreateSnippetError(null);
    setCreateSnippetSaving(false);
  }, []);

  /**
   * Adds a snippet reference chosen from the library dropdown.
   *
   * @param uuid - Snippet uuid selected in the picker.
   */
  const handleSnippetSelect = useCallback(
    (uuid: string): void => {
      const trimmedUuid = uuid.trim();
      if (!trimmedUuid) {
        return;
      }
      const snippet = snippets.find((entry) => entry.uuid === trimmedUuid);
      const stage = snippet?.stage ?? DEFAULT_SCRIPT_STAGE;
      onAddScript({
        ...createSnippetScriptRef(trimmedUuid, snippet?.name, stage),
        expanded: true
      });
    },
    [onAddScript, snippets]
  );

  /**
   * Builds grouped menu entries for the snippet library picker.
   * Incompatible snippets stay visible but disabled for the active phase.
   */
  const snippetMenuGroups = useMemo((): MenuItem[][] => {
    const createGroup: MenuItem[] = [
      { label: 'Create a snippet', onSelect: openCreateSnippetModal }
    ];

    if (snippets.length === 0) {
      return [
        createGroup,
        [{ label: 'No snippets saved yet', disabled: true, onSelect: () => undefined }]
      ];
    }

    return [
      createGroup,
      snippets.map((snippet) => {
        const compatible = snippetMatchesPhase(snippet.scope, phase);
        return {
          label: snippet.name,
          disabled: !compatible,
          onSelect: compatible ? () => handleSnippetSelect(snippet.uuid) : () => undefined
        };
      })
    ];
  }, [handleSnippetSelect, openCreateSnippetModal, phase, snippets]);

  /**
   * Reads a `.js` or snippets bundle `.json` file and imports it into the script list.
   */
  const handleImportSnippet = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.importSnippetFile(true);
      if (!result) {
        return;
      }

      if (result.kind === 'bundle') {
        const imported = result.bundle.snippets.map((entry) =>
          createInlineScriptRef(entry.code, entry.name, entry.stage)
        );
        onImportScripts(imported);
        const count = imported.length;
        toast.success(`Imported ${count} script${count === 1 ? '' : 's'}`);
        return;
      }

      setCreateSnippetDraft(createImportedSnippetDraft(result.code, snippetScopeForPhase(phase)));
      setCreateSnippetError(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import snippet');
    }
  }, [onImportScripts, phase]);

  /**
   * Exports the current phase script list as a snippets bundle JSON file.
   */
  const handleExportSnippets = useCallback(async (): Promise<void> => {
    try {
      const bundle = buildSnippetBundle(scripts, snippets, phase);
      const result = await window.api.saveTextFile(
        JSON.stringify(bundle, null, 2),
        `${phase}-request-snippets.json`
      );
      if (result.canceled) {
        return;
      }
      toast.success('Snippets bundle exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export snippets bundle');
    }
  }, [phase, scripts, snippets]);

  /**
   * Persists a new snippet from the library menu and adds it to the script list.
   */
  const handleSaveCreateSnippet = useCallback(async (): Promise<void> => {
    if (!createSnippetDraft) {
      return;
    }

    const trimmedName = createSnippetDraft.name.trim();
    if (!trimmedName) {
      setCreateSnippetError('Snippet name is required.');
      return;
    }

    setCreateSnippetSaving(true);
    setCreateSnippetError(null);

    try {
      const created = await dispatch(
        createSnippet({
          name: trimmedName,
          code: createSnippetDraft.code,
          scope: createSnippetDraft.scope,
          stage: createSnippetDraft.stage
        })
      ).unwrap();
      toast.success('Snippet created');
      onAddScript({
        ...createSnippetScriptRef(created.uuid, created.name, normalizeScriptStage(created.stage)),
        expanded: true
      });
      closeCreateSnippetModal();
    } catch (err) {
      setCreateSnippetError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setCreateSnippetSaving(false);
    }
  }, [closeCreateSnippetModal, createSnippetDraft, dispatch, onAddScript]);

  const createSnippetModal =
    createSnippetDraft != null ? (
      <SnippetEditModal
        draft={createSnippetDraft}
        isNew
        saving={createSnippetSaving}
        error={createSnippetError}
        onChange={setCreateSnippetDraft}
        onCancel={closeCreateSnippetModal}
        onSave={() => void handleSaveCreateSnippet()}
      />
    ) : null;

  return {
    snippetMenuGroups,
    openCreateSnippetModal,
    handleImportSnippet,
    handleExportSnippets,
    createSnippetModal
  };
}
