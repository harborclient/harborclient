import { Button, FaIcon, RowActionsMenu, type MenuItem } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { LiveServerScriptRef, ScriptRef, Snippet, Variable } from '@harborclient/core/types';
import {
  createScriptRefFromClipboard,
  createSnippetScriptRef
} from '@harborclient/core/scriptRefs';
import { snippetMatchesPhase } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE } from '@harborclient/core/scriptStage';
import {
  faCircleQuestion,
  faCode,
  faFileExport,
  faFileImport,
  faPaste,
  faPlus
} from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectCopiedScriptRef } from '#/renderer/src/store/slices/scriptClipboardSlice';
import { newBrowserTab } from '#/renderer/src/store/slices/tabsSlice';
import { REQUEST_SCRIPTS_HELP_URL } from '#/renderer/src/ui/Shared/Script/scriptPlaceholders';
import { SNIPPET_LIBRARY_MENU_ID } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/constants';
import { scriptRowLabel } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/helpers';
import { useScriptSnippetActions } from '#/renderer/src/ui/Shared/Script/useScriptSnippetActions';
import { LiveServerScriptSection } from './LiveServerScriptSection';
import {
  createLiveServerInlineScriptRef,
  normalizeLiveServerEditorScripts,
  toLiveServerScriptRef
} from './liveServerScriptHelpers';

interface Props {
  /**
   * Pre-request live-server scripts (run before proxy / Run command traffic).
   */
  preRequestScripts: LiveServerScriptRef[];

  /**
   * Post-request live-server scripts (run after the response is ready).
   */
  postRequestScripts: LiveServerScriptRef[];

  /**
   * Called when the pre-request script list changes.
   *
   * @param scripts - Updated pre-request refs.
   */
  onPreRequestScriptsChange: (scripts: LiveServerScriptRef[]) => void;

  /**
   * Called when the post-request script list changes.
   *
   * @param scripts - Updated post-request refs.
   */
  onPostRequestScriptsChange: (scripts: LiveServerScriptRef[]) => void;

  /**
   * Snippet library entries for pickers and save-as-snippet flows.
   */
  snippets: Snippet[];

  /**
   * Variables for CodeMirror highlighting (global or empty is fine).
   */
  variables: Variable[];
}

/**
 * Live Server Scripts tab: PreRequest and PostRequest lists with path-match rows.
 *
 * Scripts run only when the request path matches each row's pattern. Pre-request
 * scripts finish before proxy and companion Run-command traffic.
 */
export function LiveServerScriptsSettings({
  preRequestScripts,
  postRequestScripts,
  onPreRequestScriptsChange,
  onPostRequestScriptsChange,
  snippets,
  variables
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const copiedScript = useAppSelector(selectCopiedScriptRef);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  /**
   * Phase that receives the next script from the shared create-snippet modal.
   * A ref avoids stale React state when open + save happen across renders.
   */
  const createSnippetPhaseRef = useRef<'pre' | 'post'>('pre');

  /**
   * Normalized pre-request rows used for toolbar export and paste targets.
   */
  const normalizedPre = useMemo(
    () => normalizeLiveServerEditorScripts(preRequestScripts),
    [preRequestScripts]
  );

  /**
   * Normalized post-request rows for appending create-snippet results.
   */
  const normalizedPost = useMemo(
    () => normalizeLiveServerEditorScripts(postRequestScripts),
    [postRequestScripts]
  );

  const normalizedPreRef = useRef(normalizedPre);
  const normalizedPostRef = useRef(normalizedPost);

  /**
   * Syncs normalized script lists into refs after render.
   *
   * Triggered when pre/post script props change so the create-snippet modal
   * callback can append against the latest lists without recreating handlers.
   */
  useEffect(() => {
    normalizedPreRef.current = normalizedPre;
    normalizedPostRef.current = normalizedPost;
  }, [normalizedPre, normalizedPost]);

  /**
   * Appends a script ref to the phase recorded when the create-snippet modal opened.
   *
   * @param script - Shared script ref to wrap with a default match path.
   */
  const handleAddFromCreateModal = useCallback(
    (script: ScriptRef): void => {
      const liveScript = toLiveServerScriptRef({ ...script, stage: 'main' });
      if (createSnippetPhaseRef.current === 'post') {
        onPostRequestScriptsChange([...normalizedPostRef.current, liveScript]);
        return;
      }
      onPreRequestScriptsChange([...normalizedPreRef.current, liveScript]);
    },
    [onPostRequestScriptsChange, onPreRequestScriptsChange]
  );

  /**
   * Appends imported inline scripts to PreRequest (toolbar Import default).
   *
   * @param scripts - Inline refs from a snippets bundle.
   */
  const handleImportToPre = useCallback(
    (scripts: ScriptRef[]): void => {
      onPreRequestScriptsChange([
        ...normalizedPre,
        ...scripts.map((script) => toLiveServerScriptRef({ ...script, stage: 'main' }))
      ]);
    },
    [normalizedPre, onPreRequestScriptsChange]
  );

  const { openCreateSnippetModal, handleImportSnippet, handleExportSnippets, createSnippetModal } =
    useScriptSnippetActions({
      phase: 'pre',
      snippets,
      scripts: normalizedPre,
      onAddScript: handleAddFromCreateModal,
      onImportScripts: handleImportToPre
    });

  /**
   * Opens the create-snippet modal so the result is appended to PreRequest.
   */
  const handleCreateSnippetForPre = useCallback((): void => {
    createSnippetPhaseRef.current = 'pre';
    openCreateSnippetModal('pre');
  }, [openCreateSnippetModal]);

  /**
   * Opens the create-snippet modal so the result is appended to PostRequest.
   */
  const handleCreateSnippetForPost = useCallback((): void => {
    createSnippetPhaseRef.current = 'post';
    openCreateSnippetModal('post');
  }, [openCreateSnippetModal]);

  /**
   * Adds an existing library snippet to PreRequest (toolbar Snippets picker).
   *
   * @param uuid - Snippet uuid selected in the toolbar menu.
   */
  const handleToolbarSnippetSelect = useCallback(
    (uuid: string): void => {
      const trimmedUuid = uuid.trim();
      if (!trimmedUuid) {
        return;
      }
      const snippet = snippets.find((entry) => entry.uuid === trimmedUuid);
      onPreRequestScriptsChange([
        ...normalizedPre,
        toLiveServerScriptRef({
          ...createSnippetScriptRef(trimmedUuid, snippet?.name, DEFAULT_SCRIPT_STAGE),
          expanded: true
        })
      ]);
    },
    [normalizedPre, onPreRequestScriptsChange, snippets]
  );

  /**
   * Toolbar Snippets menu: create and pick both target PreRequest.
   */
  const toolbarSnippetMenuGroups = useMemo((): MenuItem[][] => {
    const createGroup: MenuItem[] = [
      { label: 'Create a snippet', onSelect: handleCreateSnippetForPre }
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
        const compatible = snippetMatchesPhase(snippet.scope, 'pre');
        return {
          label: snippet.name,
          disabled: !compatible,
          onSelect: compatible ? () => handleToolbarSnippetSelect(snippet.uuid) : () => undefined
        };
      })
    ];
  }, [handleCreateSnippetForPre, handleToolbarSnippetSelect, snippets]);

  /**
   * Adds a blank inline script to PreRequest (toolbar Add default).
   */
  const handleAdd = useCallback((): void => {
    onPreRequestScriptsChange([...normalizedPre, createLiveServerInlineScriptRef()]);
  }, [normalizedPre, onPreRequestScriptsChange]);

  /**
   * Pastes a copied script into PreRequest with a default match path.
   */
  const handlePasteScript = useCallback((): void => {
    if (!copiedScript) {
      return;
    }

    const created = createScriptRefFromClipboard(copiedScript, snippets);
    if (!created) {
      toast.error('That snippet no longer exists in the library.');
      return;
    }

    const liveScript = toLiveServerScriptRef({ ...created, stage: 'main' });
    onPreRequestScriptsChange([...normalizedPre, liveScript]);
    toast.success(`Pasted "${scriptRowLabel(liveScript, snippets)}"`);
  }, [copiedScript, normalizedPre, onPreRequestScriptsChange, snippets]);

  /**
   * Opens the request scripting documentation in an in-app Live Page tab.
   */
  const handleOpenScriptingHelp = useCallback((): void => {
    dispatch(
      newBrowserTab({
        url: REQUEST_SCRIPTS_HELP_URL,
        homeUrl: REQUEST_SCRIPTS_HELP_URL
      })
    );
  }, [dispatch]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="m-0 text-muted">
        Scripts run only when the request path matches. Pre-request scripts finish before proxy and
        Run command traffic.
      </p>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          onClick={handleAdd}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
          Add
        </Button>
        <RowActionsMenu
          menuId={SNIPPET_LIBRARY_MENU_ID}
          openMenuId={openMenuId}
          onOpenChange={setOpenMenuId}
          groups={toolbarSnippetMenuGroups}
          triggerVariant="secondary"
          triggerIcon={faCode}
          triggerLabel="Snippets"
          triggerAriaLabel="Snippets"
          triggerClassName="inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
        />
        <Button
          type="button"
          variant="secondary"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          aria-label="Import JavaScript snippet or snippets bundle"
          onClick={() => void handleImportSnippet()}
        >
          <FaIcon icon={faFileImport} className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          aria-label="Export snippets bundle"
          disabled={normalizedPre.length === 0}
          onClick={() => void handleExportSnippets()}
        >
          <FaIcon icon={faFileExport} className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          aria-label="Paste script"
          title={copiedScript ? 'Paste script' : 'Nothing copied yet'}
          disabled={!copiedScript}
          onClick={handlePasteScript}
        >
          <FaIcon icon={faPaste} className="h-3.5 w-3.5" aria-hidden />
          Paste
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          aria-label="Help"
          title="Scripting help"
          onClick={handleOpenScriptingHelp}
        >
          <FaIcon icon={faCircleQuestion} className="h-3.5 w-3.5" aria-hidden />
          Help
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <LiveServerScriptSection
          phase="pre"
          scripts={preRequestScripts}
          onChange={onPreRequestScriptsChange}
          snippets={snippets}
          variables={variables}
          onRequestCreateSnippet={handleCreateSnippetForPre}
          openMenuId={openMenuId}
          onOpenMenuChange={setOpenMenuId}
        />
        <LiveServerScriptSection
          phase="post"
          scripts={postRequestScripts}
          onChange={onPostRequestScriptsChange}
          snippets={snippets}
          variables={variables}
          onRequestCreateSnippet={handleCreateSnippetForPost}
          openMenuId={openMenuId}
          onOpenMenuChange={setOpenMenuId}
        />
      </div>

      {createSnippetModal}
    </div>
  );
}
