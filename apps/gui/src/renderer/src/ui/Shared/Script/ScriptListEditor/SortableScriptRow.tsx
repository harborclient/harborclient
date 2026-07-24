import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, CodeEditor, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import type { MenuItem } from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type MouseEvent as ReactMouseEvent
} from 'react';
import toast from 'react-hot-toast';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { CodeEditorSlashTrigger, CodeEditorTextSelection } from '@harborclient/sdk/components';
import { resolveScriptSourceCode } from '#/shared/scriptRefs';
import { CodePreviewTooltip } from '#/renderer/src/ui/Shared/CodePreview/CodePreviewTooltip';
import { buildCodePreview } from '#/renderer/src/ui/Shared/CodePreview/codePreview';
import { scriptRowIconButtonClass } from '#/renderer/src/ui/Shared/classes';
import { SCRIPT_ASK_COMMANDS } from '#/renderer/src/scripting/scriptAskCommands';
import { runScriptAsk } from '#/renderer/src/scripting/runScriptAsk';
import { resolveScriptAskModelId } from '#/renderer/src/scripting/scriptAskModel';
import { ScriptAskModal } from '#/renderer/src/ui/Shared/Script/ScriptAskModal';
import {
  COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
  COPY_TO_CHAT_SHORTCUT_HINT
} from '#/renderer/src/hooks/useCopyToChat';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectSelectedModelByChat
} from '#/renderer/src/store/slices/aiChatSlice';
import {
  normalizeScriptStage,
  readScriptRefStage,
  SCRIPT_STAGE_OPTIONS
} from '#/shared/scriptStage';
import { getAvailableModels } from '#/shared/ai/models';
import { createLiveHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';
import {
  faChevronDown,
  faChevronUp,
  faCopy,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';
import {
  SCRIPT_EDITOR_MIN_HEIGHT,
  SCRIPT_ROW_ICON_CLASS,
  SCRIPT_ROW_PREVIEW_INDENT_CLASS
} from './constants';
import { stopDragPointerDown } from './helpers';
import { ScriptRowCodeEditor } from './ScriptRowCodeEditor';
import { ScriptRowHeader } from './ScriptRowHeader';
import { ScriptRowStageBorder } from './ScriptRowStageBorder';
import type { SortableScriptRowProps } from './types';

/**
 * One sortable script row with a draggable header and expandable editor body.
 */
export function SortableScriptRow({
  script,
  snippets,
  label,
  isExpanded,
  importableModuleNames,
  phase,
  placeholder,
  variables,
  onEditVariables,
  sortable,
  onEnabledChange,
  onNameChange,
  onRemove,
  onToggleExpanded,
  onPatchCode,
  onSaveSnippet,
  onRequestEditSnippet,
  onReadonlySnippetClick,
  onClone,
  onCopy,
  aiAvailable,
  onAskAi,
  onCopySelectionToChat,
  aiSettings,
  hubModelGroups,
  githubConnected,
  scriptEditorActions,
  stageEditable,
  onStageSelect,
  openRowMenuId,
  onOpenRowMenuChange,
  onOpenInTab,
  hideDragHandle = false,
  editorFill = false,
  forceExpanded = false
}: SortableScriptRowProps): JSX.Element {
  const snippet =
    script.kind === 'snippet'
      ? snippets.find((entry) => entry.uuid === script.snippetUuid)
      : undefined;
  const librarySnippetCode = snippet?.code ?? '';
  const snippetRevision = `${script.snippetUuid ?? ''}:${snippet?.updated_at ?? ''}`;
  const [snippetDraftCode, setSnippetDraftCode] = useState(librarySnippetCode);
  const [snippetRevisionSeen, setSnippetRevisionSeen] = useState(snippetRevision);
  const [isEditingSnippet, setIsEditingSnippet] = useState(false);
  const [askTrigger, setAskTrigger] = useState<CodeEditorSlashTrigger | null>(null);
  const [inlineAskPending, setInlineAskPending] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullScreenHostRef = useRef<HTMLDivElement>(null);
  const activeChatId = useAppSelector(selectActiveChatId);
  const selectedModelByChat = useAppSelector(selectSelectedModelByChat);
  const chatModelId = activeChatId != null ? selectedModelByChat[activeChatId] : undefined;
  const availableModels = getAvailableModels(aiSettings, hubModelGroups, githubConnected);

  const phaseRef = useRef(phase);
  const variablesRef = useRef(variables);
  const importableModuleNamesRef = useRef(importableModuleNames);
  const hcCompletionSourceRef = useRef<ReturnType<typeof createLiveHcCompletionSource> | null>(
    null
  );

  /**
   * Keeps phase, variables, and importable module names refs aligned and lazily builds
   * the live completion source once.
   */
  useEffect(() => {
    phaseRef.current = phase;
    variablesRef.current = variables;
    importableModuleNamesRef.current = importableModuleNames;
    hcCompletionSourceRef.current ??= createLiveHcCompletionSource(
      () => phaseRef.current,
      () => variablesRef.current,
      () => importableModuleNamesRef.current
    );
  }, [phase, variables, importableModuleNames]);

  /**
   * Stable delegate passed to CodeEditor; forwards to the live source stored in a ref.
   */
  const hcCompletionSource = useMemo<CompletionSource>(
    () => (context) => hcCompletionSourceRef.current?.(context) ?? null,
    []
  );

  const onPatchCodeRef = useRef(onPatchCode);

  /**
   * Keeps the patch callback ref aligned with the latest parent handler.
   */
  useEffect(() => {
    onPatchCodeRef.current = onPatchCode;
  }, [onPatchCode]);

  /**
   * Stable script patch handler for CodeEditor onChange.
   */
  const handlePatchCode = useCallback((code: string): void => {
    onPatchCodeRef.current(code);
  }, []);

  /**
   * Selection toolbar actions for inline script editors when AI chat is available.
   */
  const copyToChatSelectionActions = useMemo(
    () =>
      aiAvailable
        ? [
            {
              id: 'copy-to-chat',
              label: 'Copy to chat',
              ariaLabel: `Copy selection from ${label} to chat`,
              icon: faCopy,
              shortcutHint: COPY_TO_CHAT_SHORTCUT_HINT,
              key: COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
              onSelect: (selection: CodeEditorTextSelection): void => {
                onCopySelectionToChat({ from: selection.from, to: selection.to });
              }
            }
          ]
        : undefined,
    [aiAvailable, label, onCopySelectionToChat]
  );

  /**
   * Routes slash commands: inline ask when args are present, modal for bare `/ask`.
   */
  const handleSlashCommand = useCallback(
    (trigger: CodeEditorSlashTrigger): void => {
      if (trigger.args.trim()) {
        const modelId = resolveScriptAskModelId(availableModels, chatModelId);
        if (!modelId) {
          toast.error('No AI model available.');
          return;
        }

        setInlineAskPending(true);
        void runScriptAsk({
          code: script.code ?? '',
          line: trigger.line,
          phase,
          question: trigger.args.trim(),
          modelId,
          aiSettings,
          hubModelGroups,
          githubConnected,
          onCodeChange: handlePatchCode
        }).finally(() => {
          setInlineAskPending(false);
        });
        return;
      }

      setAskTrigger(trigger);
    },
    [
      aiSettings,
      availableModels,
      chatModelId,
      githubConnected,
      handlePatchCode,
      hubModelGroups,
      phase,
      script.code
    ]
  );

  /**
   * Exits native full screen when this row's host element is active.
   */
  const exitFullScreen = useCallback((): void => {
    if (document.fullscreenElement === fullScreenHostRef.current) {
      void document.exitFullscreen();
    }
  }, []);

  /**
   * Opens the native full screen editor for this script row.
   */
  const enterFullScreen = useCallback((): void => {
    setIsFullScreen(true);
  }, []);

  /**
   * Requests native full screen once the host element is mounted and visible.
   */
  useEffect(() => {
    if (!isFullScreen) {
      return;
    }

    const host = fullScreenHostRef.current;
    if (!host) {
      return;
    }

    void host.requestFullscreen().catch(() => {
      setIsFullScreen(false);
      toast.error('Could not enter full screen.');
    });
  }, [isFullScreen]);

  /**
   * Keeps local full screen state aligned with the browser Fullscreen API.
   */
  useEffect(() => {
    const hostElement = fullScreenHostRef.current;

    const handleFullscreenChange = (): void => {
      if (document.fullscreenElement !== fullScreenHostRef.current) {
        setIsFullScreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (hostElement != null && document.fullscreenElement === hostElement) {
        void document.exitFullscreen();
      }
    };
  }, []);

  const saveSnippetCode = script.kind === 'inline' ? (script.code ?? '') : snippetDraftCode;
  const canSaveSnippet = Boolean(saveSnippetCode.trim());
  const reorderLabel = `Reorder script "${label}"`;
  const rowExpanded = forceExpanded || isExpanded;
  const expandToggleLabel = rowExpanded ? `Collapse ${label}` : `Expand ${label}`;
  const askAiLabel = `Ask AI about ${label}`;
  const editorPanelId = useId();
  const fullScreenTitleId = useId();
  const rowMenuId = `script-row-${script.id}`;
  const scriptSourceCode = resolveScriptSourceCode(script, snippets);
  const showCodePreview = !rowExpanded && Boolean(buildCodePreview(scriptSourceCode));

  if (snippetRevision !== snippetRevisionSeen) {
    setSnippetRevisionSeen(snippetRevision);
    setSnippetDraftCode(librarySnippetCode);
    setIsEditingSnippet(false);
  }

  /**
   * Builds hamburger menu groups for save, edit, clone, and delete row actions.
   */
  const rowActionMenuGroups = useMemo((): MenuItem[][] => {
    const primaryActions: MenuItem[] = [];

    if (script.kind === 'snippet' && !isEditingSnippet) {
      primaryActions.push({
        label: 'Edit snippet',
        onSelect: () => {
          void (async () => {
            const allowed = await onRequestEditSnippet();
            if (allowed) {
              setIsEditingSnippet(true);
            }
          })();
        }
      });
    } else if (canSaveSnippet) {
      primaryActions.push({
        label: script.kind === 'snippet' ? 'Save snippet' : 'Save as snippet',
        onSelect: () => {
          onSaveSnippet(saveSnippetCode);
        }
      });
    }

    const settingsActions: MenuItem[] = [];
    if (stageEditable) {
      const currentStage = normalizeScriptStage(readScriptRefStage(script));
      for (const option of SCRIPT_STAGE_OPTIONS) {
        settingsActions.push({
          label: option.label,
          checked: option.value === currentStage,
          onSelect: () => onStageSelect(option.value)
        });
      }
    }

    const viewActions: MenuItem[] = [
      {
        label: 'Full screen',
        onSelect: enterFullScreen
      }
    ];
    if (onOpenInTab) {
      viewActions.unshift({
        label: 'Open tab',
        onSelect: onOpenInTab
      });
    }

    return [
      ...(primaryActions.length > 0 ? [primaryActions] : []),
      ...(settingsActions.length > 0 ? [settingsActions] : []),
      viewActions,
      [
        { label: 'Copy', onSelect: onCopy },
        { label: 'Clone', onSelect: onClone }
      ],
      [{ label: 'Delete', variant: 'danger', onSelect: onRemove }]
    ];
  }, [
    canSaveSnippet,
    enterFullScreen,
    isEditingSnippet,
    onClone,
    onCopy,
    onOpenInTab,
    onStageSelect,
    onRemove,
    onRequestEditSnippet,
    onSaveSnippet,
    stageEditable,
    saveSnippetCode,
    script
  ]);

  /**
   * Shows the read-only snippet hint when the user clicks the editor, skipping tooltip actions.
   *
   * @param event - Click event from the snippet editor wrapper.
   */
  const handleReadonlySnippetEditorClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (isEditingSnippet) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.hc-code-editor-tooltip')) {
      return;
    }

    onReadonlySnippetClick();
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: script.id, disabled: !sortable });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined
  };

  const rowShellClassName = editorFill
    ? 'flex min-h-0 flex-1 rounded-2xl border border-l-0 border-separator bg-surface shadow-sm'
    : 'flex rounded-2xl border border-l-0 border-separator bg-surface shadow-sm';

  const rowContentClassName = editorFill
    ? 'flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3'
    : 'flex min-w-0 flex-1 flex-col px-4 py-3';

  /**
   * Renders the inline or snippet script source editor, optionally filling available height.
   *
   * @param fill - When true, uses a flex-growing CodeEditor instead of persisted row height.
   * @returns Code editor element for the current script row.
   */
  const renderScriptCodeEditor = (fill: boolean): JSX.Element => {
    const editorClassName = fill ? 'min-h-0 flex-1' : undefined;
    const editorMinHeight = fill ? '0' : SCRIPT_EDITOR_MIN_HEIGHT;

    if (script.kind === 'inline') {
      if (fill) {
        return (
          <CodeEditor
            value={script.code ?? ''}
            onChange={handlePatchCode}
            editable={!inlineAskPending}
            language="javascript"
            completionSource={hcCompletionSource}
            slashCommands={aiAvailable ? SCRIPT_ASK_COMMANDS : undefined}
            onSlashCommand={aiAvailable ? handleSlashCommand : undefined}
            selectionActions={copyToChatSelectionActions}
            placeholder={placeholder}
            placeholderHighlight
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight={editorMinHeight}
            className={editorClassName}
            aria-label={`${label} source`}
          />
        );
      }

      return (
        <ScriptRowCodeEditor
          key={script.id}
          scriptId={script.id}
          value={script.code ?? ''}
          onChange={handlePatchCode}
          editable={!inlineAskPending}
          language="javascript"
          completionSource={hcCompletionSource}
          slashCommands={aiAvailable ? SCRIPT_ASK_COMMANDS : undefined}
          onSlashCommand={aiAvailable ? handleSlashCommand : undefined}
          selectionActions={copyToChatSelectionActions}
          placeholder={placeholder}
          placeholderHighlight
          variables={variables}
          onEditVariable={onEditVariables}
          aria-label={`${label} source`}
        />
      );
    }

    if (fill) {
      return (
        <CodeEditor
          value={snippetDraftCode}
          onChange={setSnippetDraftCode}
          readOnly={!isEditingSnippet}
          language="javascript"
          completionSource={hcCompletionSource}
          slashCommands={aiAvailable ? SCRIPT_ASK_COMMANDS : undefined}
          selectionActions={copyToChatSelectionActions}
          placeholder={placeholder}
          placeholderHighlight
          variables={variables}
          onEditVariable={onEditVariables}
          minHeight={editorMinHeight}
          className={editorClassName}
          aria-label={`${label} source`}
        />
      );
    }

    return (
      <ScriptRowCodeEditor
        key={script.id}
        scriptId={script.id}
        value={snippetDraftCode}
        onChange={setSnippetDraftCode}
        readOnly={!isEditingSnippet}
        language="javascript"
        completionSource={hcCompletionSource}
        slashCommands={aiAvailable ? SCRIPT_ASK_COMMANDS : undefined}
        selectionActions={copyToChatSelectionActions}
        placeholder={placeholder}
        placeholderHighlight
        variables={variables}
        onEditVariable={onEditVariables}
        aria-label={`${label} source`}
      />
    );
  };

  const editorPanelClassName = editorFill
    ? 'mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden'
    : 'mt-2 flex flex-col gap-2';

  return (
    <>
      <li ref={setNodeRef} style={style} className={rowShellClassName}>
        <ScriptRowStageBorder
          stage={readScriptRefStage(script)}
          reorderLabel={reorderLabel}
          draggable={sortable && !hideDragHandle}
          setActivatorNodeRef={setActivatorNodeRef}
          attributes={attributes}
          listeners={listeners}
        />
        <div className={rowContentClassName}>
          <div className={editorFill ? 'flex shrink-0 flex-col gap-0.5' : 'flex flex-col gap-0.5'}>
            <div className="flex min-w-0 items-center gap-3">
              <ScriptRowHeader
                script={script}
                snippets={snippets}
                onEnabledChange={onEnabledChange}
                onNameChange={onNameChange}
              />

              <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
                {scriptEditorActions.map((action) => (
                  <Button
                    key={`${action.pluginId}:${action.id}`}
                    type="button"
                    variant="icon"
                    className={scriptRowIconButtonClass}
                    aria-label={action.title}
                    title={action.title}
                    onPointerDown={stopDragPointerDown}
                    onClick={() =>
                      void window.api.executePluginAgentCommand(action.pluginId, action.command, [
                        {
                          phase,
                          scriptId: script.id,
                          code: scriptSourceCode
                        }
                      ])
                    }
                  >
                    {action.icon ? (
                      <span aria-hidden="true" className="text-[14px] leading-none">
                        {action.icon}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="text-[12px] font-semibold leading-none">
                        {action.title.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Button>
                ))}
                {aiAvailable ? (
                  <Button
                    type="button"
                    variant="icon"
                    className={scriptRowIconButtonClass}
                    aria-label={askAiLabel}
                    title={askAiLabel}
                    onPointerDown={stopDragPointerDown}
                    onClick={onAskAi}
                  >
                    <FaIcon icon={faWandMagicSparkles} className={SCRIPT_ROW_ICON_CLASS} />
                  </Button>
                ) : null}
                <div className="shrink-0" onPointerDown={stopDragPointerDown}>
                  <RowActionsMenu
                    menuId={rowMenuId}
                    openMenuId={openRowMenuId}
                    onOpenChange={onOpenRowMenuChange}
                    groups={rowActionMenuGroups}
                  />
                </div>
                {!forceExpanded ? (
                  <Button
                    type="button"
                    variant="icon"
                    className={scriptRowIconButtonClass}
                    aria-controls={editorPanelId}
                    aria-expanded={rowExpanded}
                    aria-label={expandToggleLabel}
                    title={expandToggleLabel}
                    onPointerDown={stopDragPointerDown}
                    onClick={onToggleExpanded}
                  >
                    <FaIcon
                      icon={rowExpanded ? faChevronUp : faChevronDown}
                      className={SCRIPT_ROW_ICON_CLASS}
                    />
                  </Button>
                ) : null}
              </div>
            </div>

            {showCodePreview ? (
              <div className={`min-w-0 ${SCRIPT_ROW_PREVIEW_INDENT_CLASS}`}>
                <CodePreviewTooltip
                  code={resolveScriptSourceCode(script, snippets)}
                  actionLabel={`Expand ${label}`}
                  onClick={onToggleExpanded}
                  onPointerDown={stopDragPointerDown}
                />
              </div>
            ) : null}
          </div>

          {rowExpanded && script.kind === 'inline' && (
            <div
              id={editorPanelId}
              role="region"
              aria-label={`${label} source editor`}
              className={editorPanelClassName}
            >
              {renderScriptCodeEditor(editorFill)}
              {askTrigger ? (
                <ScriptAskModal
                  trigger={askTrigger}
                  code={script.code ?? ''}
                  phase={phase}
                  aiSettings={aiSettings}
                  hubModelGroups={hubModelGroups}
                  githubConnected={githubConnected}
                  preferredChatModelId={chatModelId}
                  onApply={handlePatchCode}
                  onClose={() => setAskTrigger(null)}
                />
              ) : null}
            </div>
          )}

          {rowExpanded && script.kind === 'snippet' && (
            <div
              id={editorPanelId}
              role="region"
              aria-label={`${label} source editor`}
              className={editorPanelClassName}
              onClick={handleReadonlySnippetEditorClick}
            >
              {renderScriptCodeEditor(editorFill)}
            </div>
          )}
        </div>
      </li>

      <div
        ref={fullScreenHostRef}
        className={isFullScreen ? 'flex h-full w-full min-h-0 flex-col bg-surface p-4' : 'hidden'}
        aria-hidden={!isFullScreen}
      >
        {isFullScreen ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
              <h2 id={fullScreenTitleId} className="m-0 min-w-0 truncate font-medium text-text">
                {label}
              </h2>
              <Button type="button" onClick={exitFullScreen} aria-label="Exit full screen">
                Exit full screen
              </Button>
            </div>
            <p role="status" aria-live="polite" className="sr-only">
              Full screen editor open
            </p>
            <div
              role="region"
              aria-labelledby={fullScreenTitleId}
              className="flex min-h-0 flex-1 flex-col"
              onClick={script.kind === 'snippet' ? handleReadonlySnippetEditorClick : undefined}
            >
              {renderScriptCodeEditor(true)}
            </div>
            {askTrigger && script.kind === 'inline' ? (
              <ScriptAskModal
                trigger={askTrigger}
                code={script.code ?? ''}
                phase={phase}
                aiSettings={aiSettings}
                hubModelGroups={hubModelGroups}
                githubConnected={githubConnected}
                preferredChatModelId={chatModelId}
                onApply={handlePatchCode}
                onClose={() => setAskTrigger(null)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
