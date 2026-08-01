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
import type { MenuItem } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { LiveServerScriptRef, ScriptRef, Snippet, Variable } from '@harborclient/core/types';
import {
  copyScriptRefForClipboard,
  createInlineScriptRef,
  createSnippetScriptRef,
  linkScriptRefToSnippet,
  resolveScriptSourceCode
} from '@harborclient/core/scriptRefs';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { snippetMatchesPhase, snippetScopeForPhase } from '@harborclient/core/snippetScope';
import {
  DEFAULT_SCRIPT_STAGE,
  normalizeScriptStage,
  readScriptRefStage,
  scriptStageBorderColor
} from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import { isImportableSnippetName } from '@harborclient/core/snippetImport';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectGithubModelsConnected,
  selectHubModelGroups
} from '#/renderer/src/store/slices/aiChatSlice';
import { setCopiedScript } from '#/renderer/src/store/slices/scriptClipboardSlice';
import { createSnippet, updateSnippet } from '#/renderer/src/store/thunks/snippets';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { usePluginScriptEditorActions } from '#/renderer/src/plugins/pluginHooks';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import {
  normalizeEditorPlaceholder,
  PRE_REQUEST_SCRIPT_PLACEHOLDER,
  POST_REQUEST_SCRIPT_PLACEHOLDER
} from '#/renderer/src/ui/Shared/Script/scriptPlaceholders';
import { SCRIPT_ROW_STAGE_BORDER_CLASS } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/constants';
import {
  buildScriptGroupActionMenuGroups,
  saveSnippetDefaultName,
  scriptRowLabel
} from '#/renderer/src/ui/Shared/Script/ScriptListEditor/helpers';
import { SaveSnippetNameModal } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/SaveSnippetNameModal';
import { ScriptGroupHeading } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/ScriptGroupHeading';
import { SortableScriptRow } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/SortableScriptRow';
import { LiveServerScriptRowHeader } from './LiveServerScriptRowHeader';
import {
  createLiveServerInlineScriptRef,
  normalizeLiveServerEditorScripts,
  toLiveServerScriptRef
} from './liveServerScriptHelpers';

interface Props {
  /**
   * Whether this section edits pre-request or post-request live-server scripts.
   */
  phase: 'pre' | 'post';

  /**
   * Ordered live-server script rows for this phase.
   */
  scripts: LiveServerScriptRef[];

  /**
   * Called when the phase script list changes.
   *
   * @param scripts - Updated live-server script refs.
   */
  onChange: (scripts: LiveServerScriptRef[]) => void;

  /**
   * Snippet library entries for labels, pickers, and save flows.
   */
  snippets: Snippet[];

  /**
   * Variables for CodeMirror highlighting (global or empty is fine).
   */
  variables: Variable[];

  /**
   * Opens the shared create-snippet modal targeting this section's phase.
   */
  onRequestCreateSnippet: () => void;

  /**
   * Id of the currently open row/section menu, or null when all are closed.
   */
  openMenuId: string | null;

  /**
   * Called when a row or section menu opens or closes.
   *
   * @param id - Menu id, or null when closed.
   */
  onOpenMenuChange: (id: string | null) => void;
}

/**
 * One PreRequest or PostRequest live-server script section with sortable rows.
 *
 * Reuses {@link ScriptGroupHeading} and {@link SortableScriptRow}, but swaps the
 * row header for a path-match input. Stage picking is hidden (`main` only).
 */
export function LiveServerScriptSection({
  phase,
  scripts,
  onChange,
  snippets,
  variables,
  onRequestCreateSnippet,
  openMenuId,
  onOpenMenuChange
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
  const { aiSettings } = useAiAvailability();
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const githubConnected = useAppSelector(selectGithubModelsConnected);
  const scriptEditorActions = usePluginScriptEditorActions(phase);

  const heading = phase === 'pre' ? 'PreRequest' : 'PostRequest';
  const menuLabel = `${heading} script actions`;
  const enableLabel = `Enable all ${heading} scripts`;
  const headingId = `live-server-${phase}-scripts-heading`;
  const panelId = `${headingId}-panel`;
  const menuId = `live-server-script-group-${phase}`;

  /**
   * Normalized editor rows with stable ids and defaulted match paths.
   */
  const normalized = useMemo(() => normalizeLiveServerEditorScripts(scripts), [scripts]);

  /**
   * Importable module names for `./` autocomplete in the script editor.
   */
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

  /**
   * Placeholder text with literal \\n sequences expanded for CodeMirror display.
   */
  const editorPlaceholder = useMemo(
    () =>
      normalizeEditorPlaceholder(
        phase === 'pre' ? PRE_REQUEST_SCRIPT_PLACEHOLDER : POST_REQUEST_SCRIPT_PLACEHOLDER
      ),
    [phase]
  );

  const [expanded, setExpanded] = useState(true);
  const [activeDragScriptId, setActiveDragScriptId] = useState<string | null>(null);
  const [saveSnippetTarget, setSaveSnippetTarget] = useState<{
    scriptId: string;
    code: string;
  } | null>(null);
  const [saveSnippetSaving, setSaveSnippetSaving] = useState(false);
  const [saveSnippetError, setSaveSnippetError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableEnabled = normalized.length > 1;

  /**
   * Script row currently shown in the drag overlay.
   */
  const activeDragScript = useMemo(
    () => normalized.find((script) => script.id === activeDragScriptId) ?? null,
    [normalized, activeDragScriptId]
  );

  /**
   * Replaces the phase script list with a normalized copy.
   *
   * @param next - Updated live-server script references.
   */
  const updateScripts = useCallback(
    (next: LiveServerScriptRef[]): void => {
      onChange(normalizeLiveServerEditorScripts(next));
    },
    [onChange]
  );

  /**
   * Appends a blank inline script with the default match path.
   */
  const handleAddInline = useCallback((): void => {
    setExpanded(true);
    updateScripts([...normalized, createLiveServerInlineScriptRef()]);
  }, [normalized, updateScripts]);

  /**
   * Adds a library snippet reference to this section with the default match path.
   *
   * @param uuid - Snippet uuid selected in the section menu.
   */
  const handleSnippetSelect = useCallback(
    (uuid: string): void => {
      const trimmedUuid = uuid.trim();
      if (!trimmedUuid) {
        return;
      }
      const snippet = snippets.find((entry) => entry.uuid === trimmedUuid);
      setExpanded(true);
      updateScripts([
        ...normalized,
        toLiveServerScriptRef({
          ...createSnippetScriptRef(trimmedUuid, snippet?.name, DEFAULT_SCRIPT_STAGE),
          expanded: true
        })
      ]);
    },
    [normalized, snippets, updateScripts]
  );

  /**
   * Snippets submenu for this section's hamburger (adds into this phase only).
   */
  const sectionSnippetMenuGroups = useMemo((): MenuItem[][] => {
    const createGroup: MenuItem[] = [
      { label: 'Create a snippet', onSelect: onRequestCreateSnippet }
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
  }, [handleSnippetSelect, onRequestCreateSnippet, phase, snippets]);

  /**
   * Enables or disables every script in this section.
   *
   * @param enabled - Whether all scripts should run when their path matches.
   */
  const handleGroupEnabledChange = useCallback(
    (enabled: boolean): void => {
      updateScripts(normalized.map((script) => ({ ...script, enabled })));
    },
    [normalized, updateScripts]
  );

  /**
   * Updates one script reference by id.
   *
   * @param id - Script list entry id.
   * @param patch - Partial fields to merge (including `matchPath`).
   */
  const patchScript = useCallback(
    (id: string, patch: Partial<LiveServerScriptRef>): void => {
      updateScripts(
        normalized.map((script) => (script.id === id ? { ...script, ...patch } : script))
      );
    },
    [normalized, updateScripts]
  );

  /**
   * Replaces one script reference by id.
   *
   * @param id - Script list entry id.
   * @param next - Updated script reference.
   */
  const replaceScript = useCallback(
    (id: string, next: LiveServerScriptRef): void => {
      updateScripts(normalized.map((script) => (script.id === id ? next : script)));
    },
    [normalized, updateScripts]
  );

  /**
   * Section hamburger groups: New script plus a Snippets submenu for this phase.
   */
  const menuGroups = useMemo(
    () =>
      buildScriptGroupActionMenuGroups('main', ['main'], {
        onAddStage: () => handleAddInline(),
        snippetMenuGroups: sectionSnippetMenuGroups
      }),
    [handleAddInline, sectionSnippetMenuGroups]
  );

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
   * @param scope - Snippet phase scope.
   * @param stage - Default stage stored on the snippet.
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
        replaceScript(
          script.id,
          toLiveServerScriptRef(
            linkScriptRefToSnippet(script, created.uuid, trimmedName),
            script.matchPath
          )
        );
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
      replaceScript(
        script.id,
        toLiveServerScriptRef(
          linkScriptRefToSnippet(script, created.uuid, trimmedName),
          script.matchPath
        )
      );
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
    const clone = toLiveServerScriptRef(
      {
        ...createInlineScriptRef(code, `${baseName} (copy)`, DEFAULT_SCRIPT_STAGE),
        expanded: script.expanded ?? true
      },
      script.matchPath
    );
    const sourceIndex = normalized.findIndex((entry) => entry.id === id);
    if (sourceIndex < 0) {
      return;
    }

    const next = [...normalized];
    next.splice(sourceIndex + 1, 0, clone);
    updateScripts(next);
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
      message: `Remove "${label}" from the live server ${stageLabel} scripts?`,
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    updateScripts(normalized.filter((script) => script.id !== id));
  };

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

    const oldIndex = normalized.findIndex((script) => script.id === active.id);
    const newIndex = normalized.findIndex((script) => script.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    updateScripts(arrayMove(normalized, oldIndex, newIndex));
  };

  /**
   * Renders a path-match header instead of the default script name control.
   *
   * @param headerProps - Script, snippets, and unused name-change callback from the row.
   * @returns Path-match input for the live-server row.
   */
  const renderHeader = (headerProps: {
    script: ScriptRef;
    snippets: Snippet[];
    onNameChange: (name: string) => void;
  }): JSX.Element => {
    const liveScript =
      normalized.find((entry) => entry.id === headerProps.script.id) ??
      toLiveServerScriptRef(headerProps.script);
    const label = scriptRowLabel(liveScript, headerProps.snippets);
    return (
      <LiveServerScriptRowHeader
        matchPath={liveScript.matchPath}
        scriptLabel={label}
        onMatchPathChange={(matchPath) => patchScript(liveScript.id, { matchPath })}
      />
    );
  };

  const list =
    normalized.length === 0 ? null : (
      <ul className="flex flex-col gap-5" aria-label={`${heading} scripts`}>
        {normalized.map((script) => {
          const label = scriptRowLabel(script, snippets);
          const isExpanded = script.expanded ?? false;

          return (
            <SortableScriptRow
              key={script.id}
              script={script}
              snippets={snippets}
              label={label}
              isExpanded={isExpanded}
              importableModuleNames={importableModuleNames}
              phase={phase}
              placeholder={editorPlaceholder}
              variables={variables}
              sortable={sortableEnabled}
              onEnabledChange={(enabled) => patchScript(script.id, { enabled })}
              onNameChange={(name) => patchScript(script.id, { name })}
              onRemove={() => void handleRemoveScript(script.id, label)}
              onToggleExpanded={() => patchScript(script.id, { expanded: !isExpanded })}
              onPatchCode={(code) => patchScript(script.id, { code })}
              onSaveSnippet={(code) => openSaveSnippetModal(script.id, code)}
              onRequestEditSnippet={() => handleRequestEditSnippet(label)}
              onReadonlySnippetClick={() => void handleReadonlySnippetClick(label)}
              onClone={() => void handleCloneScript(script.id, label)}
              onCopy={() => handleCopyScript(script.id, label)}
              aiAvailable={false}
              onAskAi={() => undefined}
              onCopySelectionToChat={() => undefined}
              aiSettings={aiSettings}
              hubModelGroups={hubModelGroups}
              githubConnected={githubConnected}
              scriptEditorActions={scriptEditorActions}
              stageEditable={false}
              onStageSelect={() => undefined}
              openRowMenuId={openMenuId}
              onOpenRowMenuChange={onOpenMenuChange}
              renderHeader={renderHeader}
            />
          );
        })}
      </ul>
    );

  const sortableList =
    list == null ? null : sortableEnabled ? (
      <SortableContext
        items={normalized.map((script) => script.id)}
        strategy={verticalListSortingStrategy}
      >
        {list}
      </SortableContext>
    ) : (
      list
    );

  const listBody = sortableEnabled ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragScriptId(null)}
    >
      {sortableList}
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
              {activeDragScript.matchPath || scriptRowLabel(activeDragScript, snippets)}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  ) : (
    sortableList
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <ScriptGroupHeading
        group="main"
        scripts={normalized}
        headingId={headingId}
        panelId={panelId}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onEnabledChange={handleGroupEnabledChange}
        menuId={menuId}
        openMenuId={openMenuId}
        onOpenChange={onOpenMenuChange}
        menuGroups={menuGroups}
        heading={heading}
        menuLabel={menuLabel}
        enableLabel={enableLabel}
      />
      {expanded ? (
        <div id={panelId} className={sortableList ? 'px-4 pr-6 py-3' : undefined}>
          {listBody}
        </div>
      ) : (
        <div id={panelId} hidden />
      )}

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
    </section>
  );
}
