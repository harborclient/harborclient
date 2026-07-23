import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Button, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import type { MenuItem } from '@harborclient/sdk/components';
import { Fragment, useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ScriptRef, Snippet, Variable } from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';
import {
  createInlineScriptRef,
  createScriptRefFromClipboard,
  createSnippetScriptRef,
  copyScriptRefForClipboard,
  ensureDefaultScriptRef,
  linkScriptRefToSnippet,
  normalizeScriptRefs,
  resolveScriptSourceCode,
  UNNAMED_SCRIPT_NAME
} from '#/shared/scriptRefs';
import { SnippetEditModal } from '#/renderer/src/ui/Shared/Snippet/SnippetEditModal';
import {
  createBlankSnippet,
  createImportedSnippetDraft,
  type SnippetEditDraft
} from '#/renderer/src/ui/Shared/Snippet/snippetEditDraft';
import { usePluginScriptEditorActions } from '#/renderer/src/plugins/pluginHooks';
import {
  normalizeEditorPlaceholder,
  REQUEST_SCRIPTS_HELP_URL
} from '#/renderer/src/ui/Shared/Script/scriptPlaceholders';
import { isImportableSnippetName } from '#/shared/snippetImport';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectGithubModelsConnected,
  selectHubModelGroups,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { createSnippet, updateSnippet } from '#/renderer/src/store/thunks/snippets';
import { snippetMatchesPhase, snippetScopeForPhase } from '#/shared/snippetScope';
import {
  DEFAULT_SCRIPT_STAGE,
  mergeScriptRefGroups,
  normalizeScriptStage,
  readScriptRefStage,
  scriptStageBorderColor,
  scriptStageGroup,
  shouldShowScriptSectionHeadings,
  splitScriptRefsByGroup,
  type ScriptEditorGroup
} from '#/shared/scriptStage';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import {
  selectCopiedScriptRef,
  setCopiedScript
} from '#/renderer/src/store/slices/scriptClipboardSlice';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { buildSnippetBundle } from '#/shared/snippetBundle';
import {
  faSquareMinus,
  faFileImport,
  faFileExport,
  faGear,
  faPlus,
  faCode,
  faArrowUpRightFromSquare,
  faPaste
} from '#/renderer/src/fontawesome';
import { SCRIPT_ROW_STAGE_BORDER_CLASS, SNIPPET_LIBRARY_MENU_ID } from './constants';
import { isScriptStageEditable, saveSnippetDefaultName, scriptRowLabel } from './helpers';
import { AddScriptStageModal } from './AddScriptStageModal';
import { SaveSnippetNameModal } from './SaveSnippetNameModal';
import { ScriptFlowArrow } from './ScriptFlowArrow';
import { ScriptGroupHeading } from './ScriptGroupHeading';
import { SortableScriptRow } from './SortableScriptRow';
import type { SortableScriptRowProps } from './types';

interface Props {
  /**
   * Script phase used for hc autocomplete suggestions.
   */
  phase: 'pre' | 'post';

  /**
   * Ordered script references for this phase.
   */
  scripts: ScriptRef[];

  /**
   * Called when the script list changes.
   */
  onChange: (scripts: ScriptRef[]) => void;

  /**
   * Collection-scoped variables for editor highlighting.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * Available snippet library entries for the picker.
   */
  snippets: Snippet[];

  /**
   * Placeholder shown in empty inline editors.
   */
  placeholder: string;

  /**
   * Saved request id for AI @ references; omitted on unsaved tabs.
   */
  requestId?: number;

  /**
   * Open request tab id; when set, rows offer "Open tab" to pop out a script editor page tab.
   */
  sourceTabId?: string;

  /**
   * When `single`, renders one focused script row with a fill-height editor.
   */
  variant?: 'list' | 'single';

  /**
   * Script row id to render when `variant` is `single`.
   */
  focusScriptId?: string;
}

/**
 * Ordered list editor for pre/post request scripts with inline and snippet sources.
 */
export function ScriptListEditor({
  phase,
  scripts,
  onChange,
  variables,
  onEditVariables,
  snippets,
  placeholder,
  requestId,
  sourceTabId,
  variant = 'list',
  focusScriptId
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const warnWhenEditingSnippet = useAppSelector(
    (state) => state.settings.general.warnWhenEditingSnippet
  );
  const warnWhenCloningSnippet = useAppSelector(
    (state) => state.settings.general.warnWhenCloningSnippet
  );
  const warnWhenClickingReadonlySnippet = useAppSelector(
    (state) => state.settings.general.warnWhenClickingReadonlySnippet
  );
  const { aiAvailable, aiSettings } = useAiAvailability();
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const githubConnected = useAppSelector(selectGithubModelsConnected);
  const activeChatId = useAppSelector(selectActiveChatId);
  const scriptEditorActions = usePluginScriptEditorActions(phase);
  const copiedScript = useAppSelector(selectCopiedScriptRef);
  const normalized = useMemo(() => normalizeScriptRefs(scripts), [scripts]);
  const scriptGroups = useMemo(() => splitScriptRefsByGroup(normalized), [normalized]);
  const importableModuleNames = useMemo(
    () =>
      [
        ...new Set([
          ...snippets
            .map((entry) => entry.name.trim())
            .filter((name) => isImportableSnippetName(name)),
          ...normalized
            .filter((ref) => ref.kind === 'inline')
            .map((ref) => ref.name?.trim() ?? '')
            .filter((name) => isImportableSnippetName(name))
        ])
      ].sort(),
    [snippets, normalized]
  );
  const sortableEnabled = normalized.length > 1;
  const [activeDragScriptId, setActiveDragScriptId] = useState<string | null>(null);
  const [addScriptStageModalOpen, setAddScriptStageModalOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [saveSnippetTarget, setSaveSnippetTarget] = useState<{
    scriptId: string;
    code: string;
  } | null>(null);
  const [saveSnippetSaving, setSaveSnippetSaving] = useState(false);
  const [saveSnippetError, setSaveSnippetError] = useState<string | null>(null);
  const [createSnippetDraft, setCreateSnippetDraft] = useState<SnippetEditDraft | null>(null);
  const [createSnippetSaving, setCreateSnippetSaving] = useState(false);
  const [createSnippetError, setCreateSnippetError] = useState<string | null>(null);

  /**
   * Placeholder text with literal \\n sequences expanded for CodeMirror display.
   */
  const editorPlaceholder = useMemo(() => normalizeEditorPlaceholder(placeholder), [placeholder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * Stable sortable ids for script rows grouped by stage.
   */
  const scriptGroupIds = useMemo(
    () => ({
      before: scriptGroups.before.map((script) => script.id),
      main: scriptGroups.main.map((script) => script.id),
      after: scriptGroups.after.map((script) => script.id)
    }),
    [scriptGroups]
  );

  /**
   * Whether Before/Run/After section headings should appear above non-empty groups.
   */
  const showSectionHeadings = useMemo(
    () => shouldShowScriptSectionHeadings(scriptGroups),
    [scriptGroups]
  );

  /**
   * Script row currently shown in the drag overlay.
   */
  const activeDragScript = useMemo(
    () => normalized.find((script) => script.id === activeDragScriptId) ?? null,
    [normalized, activeDragScriptId]
  );

  /**
   * Whether every script row is expanded; used for the expand/collapse-all control.
   */
  const allScriptsExpanded = useMemo(
    () => normalized.every((script) => script.expanded ?? false),
    [normalized]
  );

  /**
   * Expands every script row when any are collapsed; otherwise collapses them all.
   */
  const handleToggleExpandAll = (): void => {
    const nextExpanded = !allScriptsExpanded;
    updateScripts(normalized.map((script) => ({ ...script, expanded: nextExpanded })));
  };

  /**
   * Opens application settings on the syntax highlighting section.
   */
  const handleOpenSyntaxSettings = (): void => {
    dispatch(openPageTab({ type: 'settings', section: 'syntax' }));
  };

  /**
   * Replaces the script list with a normalized copy merged from editor groups.
   *
   * @param next - Updated script references.
   */
  const updateScripts = (next: ScriptRef[]): void => {
    onChange(normalizeScriptRefs(next));
  };

  /**
   * Replaces one group in the script editor while preserving the other groups.
   *
   * @param group - Editor group being updated.
   * @param nextGroupScripts - Updated scripts for that group.
   */
  const updateScriptGroup = (group: ScriptEditorGroup, nextGroupScripts: ScriptRef[]): void => {
    const groups = splitScriptRefsByGroup(normalized);
    updateScripts(
      mergeScriptRefGroups({
        ...groups,
        [group]: nextGroupScripts
      })
    );
  };

  /**
   * Enables or disables every script in one editor group.
   *
   * @param group - Before, run, or after group being toggled.
   * @param enabled - Whether all scripts in the group should run at send time.
   */
  const handleGroupEnabledChange = (group: ScriptEditorGroup, enabled: boolean): void => {
    updateScriptGroup(
      group,
      scriptGroups[group].map((script) => ({ ...script, enabled }))
    );
  };

  /**
   * Opens the stage picker before adding a blank inline script.
   */
  const handleOpenAddScriptModal = (): void => {
    setAddScriptStageModalOpen(true);
  };

  /**
   * Adds a new empty inline script with the selected stage.
   *
   * @param stage - Stage chosen in the add-script modal.
   */
  const handleConfirmAddInline = (stage: ScriptStage): void => {
    const created = {
      ...createInlineScriptRef('', UNNAMED_SCRIPT_NAME, stage),
      expanded: true
    };
    const groups = splitScriptRefsByGroup(normalized);
    const group = scriptStageGroup(stage);
    updateScripts(
      mergeScriptRefGroups({
        ...groups,
        [group]: [...groups[group], created]
      })
    );
    setAddScriptStageModalOpen(false);
  };

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
      const created = {
        ...createSnippetScriptRef(
          trimmedUuid,
          snippet?.name,
          snippet?.stage ?? DEFAULT_SCRIPT_STAGE
        ),
        expanded: true
      };
      const groups = splitScriptRefsByGroup(normalized);
      const group = scriptStageGroup(normalizeScriptStage(created.stage));
      onChange(
        normalizeScriptRefs(
          mergeScriptRefGroups({
            ...groups,
            [group]: [...groups[group], created]
          })
        )
      );
    },
    [normalized, onChange, snippets]
  );

  /**
   * Opens the create-snippet modal from the snippet library menu.
   */
  const openCreateSnippetModal = useCallback((): void => {
    setCreateSnippetDraft(createBlankSnippet(snippetScopeForPhase(phase)));
    setCreateSnippetError(null);
  }, [phase]);

  /**
   * Reads a `.js` or snippets bundle `.json` file and imports it into the script list.
   */
  const handleImportSnippet = async (): Promise<void> => {
    try {
      const result = await window.api.importSnippetFile(true);
      if (!result) {
        return;
      }

      if (result.kind === 'bundle') {
        const groups = splitScriptRefsByGroup(normalized);
        for (const entry of result.bundle.snippets) {
          const scriptRef = createInlineScriptRef(entry.code, entry.name, entry.stage);
          const group = scriptStageGroup(normalizeScriptStage(entry.stage));
          groups[group] = [...groups[group], scriptRef];
        }
        updateScripts(mergeScriptRefGroups(groups));
        const count = result.bundle.snippets.length;
        toast.success(`Imported ${count} script${count === 1 ? '' : 's'}`);
        return;
      }

      setCreateSnippetDraft(createImportedSnippetDraft(result.code, snippetScopeForPhase(phase)));
      setCreateSnippetError(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import snippet');
    }
  };

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
   * Exports the current phase script list as a snippets bundle JSON file.
   */
  const handleExportSnippets = async (): Promise<void> => {
    try {
      const bundle = buildSnippetBundle(normalized, snippets, phase);
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
  };

  /**
   * Closes the create-snippet modal and clears transient error state.
   */
  const closeCreateSnippetModal = (): void => {
    setCreateSnippetDraft(null);
    setCreateSnippetError(null);
    setCreateSnippetSaving(false);
  };

  /**
   * Persists a new snippet from the library menu and adds it to the script list.
   */
  const handleSaveCreateSnippet = async (): Promise<void> => {
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
      const groups = splitScriptRefsByGroup(normalized);
      const scriptRef = {
        ...createSnippetScriptRef(created.uuid, created.name, created.stage),
        expanded: true
      };
      const group = scriptStageGroup(normalizeScriptStage(scriptRef.stage));
      updateScripts(
        mergeScriptRefGroups({
          ...groups,
          [group]: [...groups[group], scriptRef]
        })
      );
      closeCreateSnippetModal();
    } catch (err) {
      setCreateSnippetError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setCreateSnippetSaving(false);
    }
  };

  /**
   * Replaces one script reference by id.
   *
   * @param id - Script list entry id.
   * @param next - Updated script reference.
   */
  const replaceScript = (id: string, next: ScriptRef): void => {
    updateScripts(normalized.map((script) => (script.id === id ? next : script)));
  };

  /**
   * Opens the save-snippet modal for one script row.
   *
   * @param scriptId - Script list entry id.
   * @param code - Source code to persist.
   */
  const openSaveSnippetModal = (scriptId: string, code: string): void => {
    setSaveSnippetTarget({ scriptId, code });
    setSaveSnippetError(null);
  };

  /**
   * Closes the save-snippet modal and clears transient error state.
   */
  const closeSaveSnippetModal = (): void => {
    setSaveSnippetTarget(null);
    setSaveSnippetError(null);
    setSaveSnippetSaving(false);
  };

  /**
   * Persists script source to the snippet library and relinks the row when needed.
   *
   * @param name - Snippet name entered in the modal.
   */
  const handleConfirmSaveSnippet = async (
    name: string,
    scope: SnippetScope,
    stage: ScriptStage
  ): Promise<void> => {
    if (!saveSnippetTarget) {
      return;
    }

    const script = normalized.find((entry) => entry.id === saveSnippetTarget.scriptId);
    if (!script) {
      closeSaveSnippetModal();
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveSnippetError('Snippet name is required.');
      return;
    }

    const code = saveSnippetTarget.code;
    const linkedSnippet =
      script.kind === 'snippet'
        ? snippets.find((entry) => entry.uuid === script.snippetUuid)
        : undefined;

    setSaveSnippetSaving(true);
    setSaveSnippetError(null);

    try {
      if (script.kind === 'inline' || !linkedSnippet) {
        const created = await dispatch(
          createSnippet({ name: trimmedName, code, scope, stage })
        ).unwrap();
        replaceScript(script.id, linkScriptRefToSnippet(script, created.uuid, trimmedName));
        toast.success('Snippet saved');
        closeSaveSnippetModal();
        return;
      }

      if (trimmedName === linkedSnippet.name.trim()) {
        await dispatch(
          updateSnippet({ id: linkedSnippet.id, name: trimmedName, code, scope, stage })
        ).unwrap();
        patchScript(script.id, { name: trimmedName });
        toast.success('Snippet saved');
        closeSaveSnippetModal();
        return;
      }

      const created = await dispatch(
        createSnippet({ name: trimmedName, code, scope, stage })
      ).unwrap();
      replaceScript(script.id, linkScriptRefToSnippet(script, created.uuid, trimmedName));
      toast.success('Snippet saved');
      closeSaveSnippetModal();
    } catch (err) {
      setSaveSnippetError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setSaveSnippetSaving(false);
    }
  };

  /**
   * Script row targeted by the save-snippet modal, if any.
   */
  const saveSnippetScript = saveSnippetTarget
    ? (normalized.find((entry) => entry.id === saveSnippetTarget.scriptId) ?? null)
    : null;

  /**
   * Updates a script row's stage and moves it into the matching editor group.
   *
   * @param id - Script list entry id.
   * @param stage - New stage for the row.
   */
  const handleStageChange = (id: string, stage: ScriptStage): void => {
    const script = normalized.find((entry) => entry.id === id);
    if (!script) {
      return;
    }

    const normalizedRole = normalizeScriptStage(stage);
    if (normalizeScriptStage(readScriptRefStage(script)) === normalizedRole) {
      return;
    }

    const groups = splitScriptRefsByGroup(normalized);
    const sourceGroup = scriptStageGroup(normalizeScriptStage(readScriptRefStage(script)));
    const targetGroup = scriptStageGroup(normalizedRole);
    const nextScript = { ...script, stage: normalizedRole };

    if (sourceGroup === targetGroup) {
      updateScriptGroup(
        sourceGroup,
        groups[sourceGroup].map((entry) => (entry.id === id ? nextScript : entry))
      );
      return;
    }

    updateScripts(
      mergeScriptRefGroups({
        ...groups,
        [sourceGroup]: groups[sourceGroup].filter((entry) => entry.id !== id),
        [targetGroup]: [...groups[targetGroup], nextScript]
      })
    );
  };

  /**
   * Updates one script reference by id.
   *
   * @param id - Script list entry id.
   * @param patch - Partial fields to merge.
   */
  const patchScript = (id: string, patch: Partial<ScriptRef>): void => {
    updateScripts(
      normalized.map((script) => (script.id === id ? { ...script, ...patch } : script))
    );
  };

  /**
   * Removes one script reference from the list, re-seeding a default when empty.
   *
   * @param id - Script list entry id.
   */
  const removeScript = (id: string): void => {
    const next = normalized.filter((script) => script.id !== id);
    const ensured = ensureDefaultScriptRef(next);
    updateScripts(ensured);
  };

  /**
   * Prompts before enabling edit mode on a linked snippet row.
   *
   * @param label - Display label shown in the confirmation message.
   * @returns Resolves to true when the user may enter edit mode.
   */
  const handleRequestEditSnippet = async (label: string): Promise<boolean> => {
    if (!warnWhenEditingSnippet) {
      return true;
    }

    const result = await showConfirm(dispatch, {
      title: 'Edit snippet?',
      message: `Editing "${label}" will change the snippet library entry for every request that uses it.`,
      confirmLabel: 'Edit snippet',
      checkboxLabel: "Don't show this again"
    });
    if (result.confirmed && result.checkboxChecked) {
      await dispatch(patchGeneralSettings({ warnWhenEditingSnippet: false }));
    }
    return result.confirmed;
  };

  /**
   * Shows an informational dialog when the user clicks a read-only linked snippet editor.
   *
   * @param label - Display label shown in the dialog message.
   */
  const handleReadonlySnippetClick = async (label: string): Promise<void> => {
    if (!warnWhenClickingReadonlySnippet) {
      return;
    }

    const result = await showConfirm(dispatch, {
      title: 'Read-only snippet',
      message: `"${label}" is linked to the snippet library and is read-only until you click the edit (pen) button. Saving the snippet here updates it globally unless saved with a different name.`,
      confirmLabel: 'OK',
      checkboxLabel: "Don't show this again"
    });
    if (result.confirmed && result.checkboxChecked) {
      await dispatch(patchGeneralSettings({ warnWhenClickingReadonlySnippet: false }));
    }
  };

  /**
   * Copies one script row into the in-memory clipboard.
   *
   * @param id - Script list entry id.
   * @param label - Display label shown in the success toast.
   */
  const handleCopyScript = (id: string, label: string): void => {
    const script = normalized.find((entry) => entry.id === id);
    if (!script) {
      return;
    }

    dispatch(setCopiedScript(copyScriptRefForClipboard(script)));
    toast.success(`Copied "${label}"`);
  };

  /**
   * Clones one script row as a detached inline copy inserted after the source row.
   *
   * @param id - Script list entry id.
   * @param label - Display label shown in confirmation messages.
   */
  const handleCloneScript = async (id: string, label: string): Promise<void> => {
    const script = normalized.find((entry) => entry.id === id);
    if (!script) {
      return;
    }

    if (script.kind === 'snippet' && warnWhenCloningSnippet) {
      const result = await showConfirm(dispatch, {
        title: 'Clone snippet?',
        message: `The copy of "${label}" will no longer be linked to the original snippet library entry.`,
        confirmLabel: 'Clone',
        checkboxLabel: "Don't show this again"
      });
      if (!result.confirmed) {
        return;
      }
      if (result.checkboxChecked) {
        await dispatch(patchGeneralSettings({ warnWhenCloningSnippet: false }));
      }
    }

    const code =
      script.kind === 'inline' ? (script.code ?? '') : resolveScriptSourceCode(script, snippets);
    const baseName = script.name?.trim() || label;
    const clone = {
      ...createInlineScriptRef(
        code,
        `${baseName} (copy)`,
        normalizeScriptStage(readScriptRefStage(script))
      ),
      expanded: script.expanded ?? true
    };
    const groups = splitScriptRefsByGroup(normalized);
    const group = scriptStageGroup(normalizeScriptStage(clone.stage));
    const sourceIndex = groups[group].findIndex((entry) => entry.id === id);
    if (sourceIndex < 0) {
      return;
    }

    const nextGroup = [...groups[group]];
    nextGroup.splice(sourceIndex + 1, 0, clone);
    updateScriptGroup(group, nextGroup);
  };

  /**
   * Inserts a new script row from the in-memory clipboard at the end of its stage group.
   */
  const handlePasteScript = (): void => {
    if (!copiedScript) {
      return;
    }

    const created = createScriptRefFromClipboard(copiedScript, snippets);
    if (!created) {
      toast.error('That snippet no longer exists in the library.');
      return;
    }

    const groups = splitScriptRefsByGroup(normalized);
    const group = scriptStageGroup(normalizeScriptStage(readScriptRefStage(created)));
    updateScripts(
      mergeScriptRefGroups({
        ...groups,
        [group]: [...groups[group], created]
      })
    );
    toast.success(`Pasted "${scriptRowLabel(created, snippets)}"`);
  };

  /**
   * Prompts before removing a script row, then updates the list when confirmed.
   *
   * @param id - Script list entry id.
   * @param label - Display label shown in the confirmation message.
   */
  const handleRemoveScript = async (id: string, label: string): Promise<void> => {
    const stageLabel = phase === 'pre' ? 'pre-request' : 'post-request';
    const confirmed = await confirm({
      title: 'Remove script',
      message: `Remove "${label}" from the ${stageLabel} stage?`,
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    removeScript(id);
  };

  /**
   * Opens or focuses a live-linked script editor page tab for one script row.
   *
   * @param scriptId - Script list entry id.
   * @param label - Tab title shown in the tab bar.
   */
  const handleOpenInTab = (scriptId: string, label: string): void => {
    if (!sourceTabId) {
      return;
    }

    dispatch(
      openPageTab({
        type: 'script-editor',
        requestTabId: sourceTabId,
        phase,
        scriptId,
        label
      })
    );
  };

  /**
   * Opens the AI sidebar, starts a fresh chat, and prefills an @ script reference.
   *
   * @param scriptIndex - 1-based index of the script row in the phase array.
   */
  const handleAskAi = async (scriptIndex: number): Promise<void> => {
    const token = `@${requestId ?? 'active'}.${phase}.${scriptIndex}\n\n`;
    dispatch(setShowAiSidebar(true));
    await dispatch(createNewChat(aiSettings));
    dispatch(setPendingComposerText(token));
  };

  /**
   * Opens the AI sidebar and inserts a script reference with the selected source range.
   *
   * @param scriptIndex - 1-based index of the script row in the phase array.
   * @param selection - Character offsets into the script source.
   */
  const handleCopySelectionToChat = async (
    scriptIndex: number,
    selection: { from: number; to: number }
  ): Promise<void> => {
    dispatch(setShowAiSidebar(true));
    if (activeChatId == null) {
      await dispatch(createNewChat(aiSettings));
    }

    dispatch(
      setPendingComposerText(
        `@${requestId ?? 'active'}.${phase}.${scriptIndex}#${selection.from}.${selection.to}`
      )
    );
  };

  /**
   * Shared row props for list and single-script render modes.
   *
   * @param script - Script reference for the row.
   * @param label - Accessible row label.
   * @param isExpanded - Whether the inline editor is expanded.
   * @param scriptIndex - 1-based index within the phase script array.
   * @param rowOptions - Optional layout overrides for pop-out tab mode.
   * @returns Props spread onto {@link SortableScriptRow}.
   */
  const buildScriptRowProps = (
    script: ScriptRef,
    label: string,
    isExpanded: boolean,
    scriptIndex: number,
    rowOptions?: {
      hideDragHandle?: boolean;
      editorFill?: boolean;
      forceExpanded?: boolean;
      sortable?: boolean;
      includeOpenInTab?: boolean;
    }
  ): SortableScriptRowProps => ({
    script,
    snippets,
    label,
    isExpanded,
    importableModuleNames,
    phase,
    placeholder: editorPlaceholder,
    variables,
    onEditVariables,
    sortable: rowOptions?.sortable ?? false,
    onEnabledChange: (enabled) => patchScript(script.id, { enabled }),
    onNameChange: (name) => patchScript(script.id, { name }),
    stageEditable: isScriptStageEditable(script, snippets),
    onStageSelect: (stage) => handleStageChange(script.id, stage),
    openRowMenuId,
    onOpenRowMenuChange: setOpenRowMenuId,
    onRemove: () => void handleRemoveScript(script.id, label),
    onToggleExpanded: () => patchScript(script.id, { expanded: !isExpanded }),
    onPatchCode: (code) => patchScript(script.id, { code }),
    onSaveSnippet: (code) => openSaveSnippetModal(script.id, code),
    onRequestEditSnippet: () => handleRequestEditSnippet(label),
    onReadonlySnippetClick: () => void handleReadonlySnippetClick(label),
    onClone: () => void handleCloneScript(script.id, label),
    onCopy: () => handleCopyScript(script.id, label),
    aiAvailable,
    onAskAi: () => void handleAskAi(scriptIndex),
    onCopySelectionToChat: (selection) => void handleCopySelectionToChat(scriptIndex, selection),
    aiSettings,
    hubModelGroups,
    githubConnected,
    scriptEditorActions,
    onOpenInTab:
      rowOptions?.includeOpenInTab && sourceTabId
        ? () => handleOpenInTab(script.id, label)
        : undefined,
    hideDragHandle: rowOptions?.hideDragHandle,
    editorFill: rowOptions?.editorFill,
    forceExpanded: rowOptions?.forceExpanded
  });

  /**
   * Records the script row being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    setActiveDragScriptId(String(event.active.id));
  };

  /**
   * Persists a new script order when a row is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    setActiveDragScriptId(null);
    if (!over || active.id === over.id) {
      return;
    }

    const activeScript = normalized.find((script) => script.id === active.id);
    const overScript = normalized.find((script) => script.id === over.id);
    if (!activeScript || !overScript) {
      return;
    }

    const group = scriptStageGroup(normalizeScriptStage(activeScript.stage));
    if (group !== scriptStageGroup(normalizeScriptStage(overScript.stage))) {
      return;
    }

    const groupScripts = scriptGroups[group];
    const oldIndex = groupScripts.findIndex((script) => script.id === active.id);
    const newIndex = groupScripts.findIndex((script) => script.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    updateScriptGroup(group, arrayMove(groupScripts, oldIndex, newIndex));
  };

  /**
   * Renders add controls aligned to the right of the script list header.
   */
  const addControls = (
    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
      <Button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
        onClick={handleOpenAddScriptModal}
      >
        <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
        Add
      </Button>
      <RowActionsMenu
        menuId={SNIPPET_LIBRARY_MENU_ID}
        openMenuId={openRowMenuId}
        onOpenChange={setOpenRowMenuId}
        groups={snippetMenuGroups}
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
        disabled={normalized.length === 0}
        onClick={() => void handleExportSnippets()}
      >
        <FaIcon icon={faFileExport} className="h-3.5 w-3.5" />
        Export
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0"
        aria-label="Paste script"
        title={copiedScript ? 'Paste script' : 'Nothing copied yet'}
        disabled={!copiedScript}
        onClick={handlePasteScript}
      >
        <FaIcon icon={faPaste} className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <div className="flex shrink-0 items-center gap-2 mr-4">
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          aria-label="Syntax highlighting settings"
          title="Syntax highlighting settings"
          onClick={handleOpenSyntaxSettings}
        >
          <FaIcon icon={faGear} className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          aria-label={allScriptsExpanded ? 'Collapse all scripts' : 'Expand all scripts'}
          title={allScriptsExpanded ? 'Collapse all scripts' : 'Expand all scripts'}
          onClick={handleToggleExpandAll}
        >
          <FaIcon icon={faSquareMinus} className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );

  /**
   * Renders the ordering hint and add controls above the script list.
   */
  const scriptListHeader = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <a
          href={REQUEST_SCRIPTS_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[14px] text-accent hover:underline"
        >
          Scripting help
          <FaIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" aria-hidden />
        </a>
      </div>
      {addControls}
    </div>
  );

  /**
   * Renders one grouped script list with optional drag handles.
   *
   * @param group - Editor stage group.
   * @param groupScripts - Scripts stored in that group.
   * @param groupLabel - Accessible name for the list.
   * @param showHeading - Whether to render a visible section heading above the list.
   */
  const renderScriptGroup = (
    group: ScriptEditorGroup,
    groupScripts: ScriptRef[],
    groupLabel: string,
    showHeading: boolean
  ): JSX.Element | null => {
    if (groupScripts.length === 0) {
      return null;
    }

    const groupSortable = groupScripts.length > 1;
    const list = (
      <ul className="flex flex-col" aria-label={groupLabel}>
        {groupScripts.map((script, index) => {
          const label = scriptRowLabel(script, snippets);
          const isExpanded = script.expanded ?? false;
          const scriptIndex = normalized.findIndex((entry) => entry.id === script.id);

          return (
            <Fragment key={script.id}>
              <SortableScriptRow
                {...buildScriptRowProps(script, label, isExpanded, scriptIndex + 1, {
                  sortable: groupSortable,
                  includeOpenInTab: true
                })}
              />
              {index < groupScripts.length - 1 ? <ScriptFlowArrow /> : null}
            </Fragment>
          );
        })}
      </ul>
    );

    const sortableList = groupSortable ? (
      <SortableContext items={scriptGroupIds[group]} strategy={verticalListSortingStrategy}>
        {list}
      </SortableContext>
    ) : (
      list
    );

    if (!showHeading) {
      return sortableList;
    }

    const headingId = `${phase}-${group}-scripts-heading`;

    return (
      <section aria-labelledby={headingId} className="flex flex-col gap-2">
        <ScriptGroupHeading
          group={group}
          phase={phase}
          scripts={groupScripts}
          headingId={headingId}
          onEnabledChange={(enabled) => handleGroupEnabledChange(group, enabled)}
        />
        {sortableList}
      </section>
    );
  };

  /**
   * Renders the grouped script row lists.
   */
  const scriptList = (
    <div className="flex flex-col gap-4">
      {renderScriptGroup(
        'before',
        scriptGroups.before,
        `${phase} before scripts`,
        showSectionHeadings
      )}
      {renderScriptGroup('main', scriptGroups.main, `${phase} main scripts`, showSectionHeadings)}
      {renderScriptGroup(
        'after',
        scriptGroups.after,
        `${phase} after scripts`,
        showSectionHeadings
      )}
    </div>
  );

  /**
   * Renders the multi-script list, optionally wrapped in drag-and-drop context.
   */
  const scriptListBody = sortableEnabled ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragScriptId(null)}
    >
      {scriptList}
      <DragOverlay>
        {activeDragScript ? (
          <div className="flex overflow-hidden rounded-2xl border border-l-0 border-separator bg-surface shadow-md">
            <span
              className={SCRIPT_ROW_STAGE_BORDER_CLASS}
              style={{
                backgroundColor: scriptStageBorderColor(readScriptRefStage(activeDragScript))
              }}
              aria-hidden="true"
            />
            <div className="px-4 py-2 text-[14px] font-medium">
              {scriptRowLabel(activeDragScript, snippets)}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  ) : (
    scriptList
  );

  const modals = (
    <>
      {saveSnippetTarget && saveSnippetScript ? (
        <SaveSnippetNameModal
          key={saveSnippetTarget.scriptId}
          defaultName={saveSnippetDefaultName(saveSnippetScript, snippets)}
          defaultScope={snippetScopeForPhase(phase)}
          defaultStage={normalizeScriptStage(saveSnippetScript.stage)}
          saving={saveSnippetSaving}
          error={saveSnippetError}
          onCancel={closeSaveSnippetModal}
          onSave={(name, scope, stage) => void handleConfirmSaveSnippet(name, scope, stage)}
        />
      ) : null}

      {addScriptStageModalOpen ? (
        <AddScriptStageModal
          onCancel={() => setAddScriptStageModalOpen(false)}
          onConfirm={handleConfirmAddInline}
        />
      ) : null}

      {createSnippetDraft ? (
        <SnippetEditModal
          draft={createSnippetDraft}
          isNew
          saving={createSnippetSaving}
          error={createSnippetError}
          onChange={setCreateSnippetDraft}
          onCancel={closeCreateSnippetModal}
          onSave={() => void handleSaveCreateSnippet()}
        />
      ) : null}
    </>
  );

  if (variant === 'single') {
    const focusedScript = focusScriptId
      ? normalized.find((script) => script.id === focusScriptId)
      : undefined;

    if (!focusedScript) {
      return <></>;
    }

    const label = scriptRowLabel(focusedScript, snippets);
    const scriptIndex = normalized.findIndex((entry) => entry.id === focusedScript.id);

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <ul className="flex min-h-0 flex-1 flex-col" aria-label={`${phase} script editor`}>
          <SortableScriptRow
            {...buildScriptRowProps(focusedScript, label, true, scriptIndex + 1, {
              hideDragHandle: true,
              editorFill: true,
              forceExpanded: true
            })}
          />
        </ul>
        {modals}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {scriptListHeader}
      <div className="hc-scroll-stable flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
        {scriptListBody}
      </div>

      {modals}
    </div>
  );
}
