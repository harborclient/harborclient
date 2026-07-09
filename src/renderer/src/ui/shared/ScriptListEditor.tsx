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
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  CodeEditor,
  FaIcon,
  FieldError,
  Input,
  Modal,
  ModalFormLayout,
  RowActionsMenu,
  Select
} from '@harborclient/sdk/components';
import type { MenuItem } from '@harborclient/sdk/components';
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import toast from 'react-hot-toast';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { CodeEditorSlashTrigger } from '@harborclient/sdk/components';
import type { AiSettings, HubLlmModelGroup, ScriptRef, Snippet, Variable } from '#/shared/types';
import type { ScriptStage } from '@harborclient/sdk';
import {
  createInlineScriptRef,
  createSnippetScriptRef,
  ensureDefaultScriptRef,
  linkScriptRefToSnippet,
  normalizeScriptRefs,
  resolveScriptSourceCode,
  UNNAMED_SCRIPT_NAME
} from '#/shared/scriptRefs';
import { CodePreviewTooltip } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import { buildCodePreview } from '#/renderer/src/ui/shared/codePreview';
import { SnippetEditModal } from '#/renderer/src/ui/shared/SnippetEditModal';
import {
  createBlankSnippet,
  createImportedSnippetDraft,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/snippetEditDraft';
import { scriptRowIconButtonClass } from '#/renderer/src/ui/shared/classes';
import { usePluginScriptEditorActions } from '#/renderer/src/plugins/pluginHooks';
import type { RegisteredScriptEditorAction } from '#/shared/plugin/types';
import {
  normalizeEditorPlaceholder,
  REQUEST_SCRIPTS_HELP_URL
} from '#/renderer/src/ui/shared/scriptPlaceholders';
import { createLiveHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';
import { SCRIPT_ASK_COMMANDS } from '#/renderer/src/scripting/scriptAskCommands';
import { runScriptAsk } from '#/renderer/src/scripting/runScriptAsk';
import { resolveScriptAskModelId } from '#/renderer/src/scripting/scriptAskModel';
import { ScriptAskModal } from '#/renderer/src/ui/shared/ScriptAskModal';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { usePersistedScriptEditorUiState } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectHubModelGroups,
  selectSelectedModelByChat,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { createSnippet, updateSnippet } from '#/renderer/src/store/thunks/snippets';
import {
  SNIPPET_SCOPE_OPTIONS,
  snippetMatchesPhase,
  snippetScopeForPhase,
  type SnippetScope
} from '#/shared/snippetScope';
import {
  DEFAULT_SCRIPT_STAGE,
  SCRIPT_EDITOR_GROUP_HEADINGS,
  SCRIPT_STAGE_OPTIONS,
  mergeScriptRefGroups,
  normalizeScriptStage,
  readScriptRefStage,
  scriptRowStageSuffix,
  scriptStageBorderColor,
  scriptStageGroup,
  shouldShowScriptSectionHeadings,
  splitScriptRefsByGroup,
  type ScriptEditorGroup
} from '#/shared/scriptStage';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { getAvailableModels } from '#/shared/ai/models';
import {
  faAnglesDown,
  faAnglesUp,
  faCaretDown,
  faChevronDown,
  faChevronUp,
  faFileImport,
  faGear,
  faGripVertical,
  faPlus,
  faTerminal,
  faArrowUpRightFromSquare,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';

const SCRIPT_EDITOR_MIN_HEIGHT = '125px';

/** Title and label typography for script row headers. */
const SCRIPT_ROW_TITLE_CLASS = 'text-[15px] font-medium text-text';

/** Icon size shared by drag handle and row action buttons. */
const SCRIPT_ROW_ICON_CLASS = 'h-4 w-4';

/** Icon size for the snippet-link indicator beside script row titles. */
const SCRIPT_ROW_SNIPPET_LINK_ICON_CLASS = 'h-3 w-3 shrink-0 text-warning';

/** Accessible name and tooltip for snippet-linked script row indicators. */
const SNIPPET_LIBRARY_LABEL = 'Snippet library';

/** Left inset aligning the code preview with the script title (checkbox width + gap). */
const SCRIPT_ROW_PREVIEW_INDENT_CLASS = 'pl-6';

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

interface ScriptRowHeaderProps {
  /**
   * Script reference rendered in the row header.
   */
  script: ScriptRef;

  /**
   * Snippet library used for default snippet labels.
   */
  snippets: Snippet[];

  /**
   * Called when the enable checkbox toggles.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Called when the optional display name changes.
   */
  onNameChange: (name: string) => void;
}

interface SortableScriptRowProps {
  /**
   * Script reference rendered in this row.
   */
  script: ScriptRef;

  /**
   * Snippet library used for labels and snippet previews.
   */
  snippets: Snippet[];

  /**
   * Accessible label for row actions.
   */
  label: string;

  /**
   * Whether the script editor body is expanded.
   */
  isExpanded: boolean;

  /**
   * Script phase used for hc autocomplete suggestions.
   */
  phase: 'pre' | 'post';

  /**
   * Placeholder shown in empty inline editors.
   */
  placeholder: string;

  /**
   * Collection-scoped variables for editor highlighting.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * When false, drag reordering is disabled but the grip handle stays visible.
   */
  sortable: boolean;

  /**
   * Called when the enable checkbox toggles.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Called when the optional display name changes.
   */
  onNameChange: (name: string) => void;

  /**
   * Called when the user removes this script row.
   */
  onRemove: () => void;

  /**
   * Toggles expanded editor content for this row.
   */
  onToggleExpanded: () => void;

  /**
   * Persists inline script source edits.
   */
  onPatchCode: (code: string) => void;

  /**
   * Opens the save-snippet modal for this row's current source code.
   */
  onSaveSnippet: (code: string) => void;

  /**
   * Prompts before enabling edit mode on a linked snippet row.
   *
   * @returns Resolves to true when the user may enter edit mode.
   */
  onRequestEditSnippet: () => Promise<boolean>;

  /**
   * Shows an informational dialog when the user clicks a read-only linked snippet editor.
   */
  onReadonlySnippetClick: () => void;

  /**
   * Clones this script row as a new inline entry inserted after the source row.
   */
  onClone: () => void;

  /**
   * Whether AI chat is available for this user.
   */
  aiAvailable: boolean;

  /**
   * Opens the AI sidebar with a fresh chat prefilled for this script row.
   */
  onAskAi: () => void;

  /**
   * AI provider settings for inline `/ask` requests.
   */
  aiSettings: AiSettings;

  /**
   * Team Hub model groups for inline `/ask` requests.
   */
  hubModelGroups: HubLlmModelGroup[];

  /**
   * Plugin row action buttons registered for this script phase.
   */
  scriptEditorActions: RegisteredScriptEditorAction[];

  /**
   * Whether the row's Stage value may be changed from the script editor.
   */
  stageEditable: boolean;

  /**
   * Applies a new stage to this script row.
   *
   * @param stage - Selected script stage.
   */
  onStageSelect: (stage: ScriptStage) => void;

  /**
   * Id of the currently open row actions menu, or null when all are closed.
   */
  openRowMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenRowMenuChange: (menuId: string | null) => void;

  /**
   * Opens a live-linked script editor page tab for this row.
   */
  onOpenInTab?: () => void;

  /**
   * When true, hides the drag reorder handle.
   */
  hideDragHandle?: boolean;

  /**
   * When true, the code editor grows to fill available vertical space.
   */
  editorFill?: boolean;

  /**
   * When true, keeps the editor expanded and hides the collapse toggle.
   */
  forceExpanded?: boolean;
}

interface SaveSnippetNameModalProps {
  /**
   * Default snippet name shown in the input.
   */
  defaultName: string;

  /**
   * Default script phase scope for the saved snippet.
   */
  defaultScope: SnippetScope;

  /**
   * Default stage for the saved snippet.
   */
  defaultStage: ScriptStage;

  /**
   * True while the save request is in flight.
   */
  saving: boolean;

  /**
   * Inline validation or IPC error message.
   */
  error: string | null;

  /**
   * Closes the modal without saving.
   */
  onCancel: () => void;

  /**
   * Persists the snippet under the entered name and scope.
   *
   * @param name - Trimmed snippet name from the modal input.
   * @param scope - Selected script phase scope.
   * @param stage - Selected script stage.
   */
  onSave: (name: string, scope: SnippetScope, stage: ScriptStage) => void;
}

interface AddScriptStageModalProps {
  /**
   * Closes the modal without adding a script.
   */
  onCancel: () => void;

  /**
   * Creates a blank inline script with the selected stage.
   *
   * @param stage - Selected script stage.
   */
  onConfirm: (stage: ScriptStage) => void;
}

interface SnippetMenuProps {
  /**
   * DOM id wired to the snippet picker trigger via aria-controls.
   */
  menuId: string;

  /**
   * Snippet library entries shown in the menu.
   */
  snippets: Snippet[];

  /**
   * Total snippets in the library before phase filtering.
   */
  totalSnippetCount: number;

  /**
   * Active script phase used for empty-state messaging.
   */
  phase: 'pre' | 'post';

  /**
   * Called when the user picks a snippet from the menu.
   *
   * @param uuid - Selected snippet uuid.
   */
  onSelect: (uuid: string) => void;

  /**
   * Opens the create-snippet modal from the menu.
   */
  onCreate: () => void;

  /**
   * Closes the snippet picker menu.
   */
  onClose: () => void;
}

/**
 * Returns whether a script row's Stage value can be edited from the list editor.
 *
 * @param script - Script reference for the row.
 * @param snippets - Snippet library used to resolve marketplace-linked rows.
 * @returns True for inline scripts and non-marketplace snippet links.
 */
function isScriptStageEditable(script: ScriptRef, snippets: Snippet[]): boolean {
  if (script.kind === 'inline') {
    return true;
  }

  const linked = snippets.find((entry) => entry.uuid === script.snippetUuid);
  return linked?.source !== 'marketplace';
}

/**
 * Stops pointer events from bubbling to the drag activator on header controls.
 *
 * @param event - Pointer event from a nested interactive control.
 */
function stopDragPointerDown(event: ReactPointerEvent): void {
  event.stopPropagation();
}

/**
 * Returns the base display name for one script row without the stage suffix.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Base label for the row header.
 */
function scriptRowBaseLabel(script: ScriptRef, snippets: Snippet[]): string {
  if (script.name?.trim()) {
    return script.name.trim();
  }
  if (script.kind === 'snippet') {
    const snippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return snippet ? `Snippet: ${snippet.name}` : 'Missing snippet';
  }
  return 'Inline script';
}

/**
 * Renders a label for one script reference row.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Display label for the row header.
 */
function scriptRowLabel(script: ScriptRef, snippets: Snippet[]): string {
  return `${scriptRowBaseLabel(script, snippets)}${scriptRowStageSuffix(readScriptRefStage(script))}`;
}

/**
 * Returns the muted placeholder shown when a script has no custom label.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Placeholder label for inline edit mode.
 */
function scriptRowPlaceholder(script: ScriptRef, snippets: Snippet[]): string {
  if (script.kind === 'snippet') {
    const snippet = snippets.find((entry) => entry.uuid === script.snippetUuid);
    return snippet ? `Snippet: ${snippet.name}` : 'Missing snippet';
  }
  return 'Inline script';
}

/**
 * Returns the default snippet name for the save modal.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Existing snippet name, script label, or placeholder label.
 */
function saveSnippetDefaultName(script: ScriptRef, snippets: Snippet[]): string {
  if (script.kind === 'snippet') {
    const linked = snippets.find((entry) => entry.uuid === script.snippetUuid);
    if (linked?.name.trim()) {
      return linked.name.trim();
    }
  }

  if (script.name?.trim()) {
    return script.name.trim();
  }

  return scriptRowPlaceholder(script, snippets);
}

/**
 * Name-only modal for saving script source to the snippet library.
 */
function SaveSnippetNameModal({
  defaultName,
  defaultScope,
  defaultStage,
  saving,
  error,
  onCancel,
  onSave
}: SaveSnippetNameModalProps): JSX.Element {
  const [name, setName] = useState(defaultName);
  const [scope, setScope] = useState<SnippetScope>(defaultScope);
  const [stage, setStage] = useState<ScriptStage>(defaultStage);
  const nameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Focuses and selects the name input when the modal opens.
   */
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  return (
    <Modal
      labelledBy="save-snippet-title"
      onClose={onCancel}
      title="Save snippet"
      description="Save this script to the reusable snippet library."
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          <Button type="button" disabled={saving} onClick={() => onSave(name, scope, stage)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-name">
              Name
            </label>
            <Input
              ref={nameInputRef}
              id="save-snippet-name"
              value={name}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSave(name, scope, stage);
                }
              }}
              placeholder="Snippet name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-scope">
              Request stage
            </label>
            <Select
              id="save-snippet-scope"
              className="w-full"
              value={scope}
              disabled={saving}
              onChange={(event) => setScope(event.target.value as SnippetScope)}
            >
              {SNIPPET_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-stage">
              Stage
            </label>
            <Select
              id="save-snippet-stage"
              className="w-full"
              value={stage}
              disabled={saving}
              onChange={(event) => setStage(event.target.value as ScriptStage)}
            >
              {SCRIPT_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}

/**
 * Modal for choosing the stage before adding a blank inline script.
 */
function AddScriptStageModal({ onCancel, onConfirm }: AddScriptStageModalProps): JSX.Element {
  const [stage, setStage] = useState<ScriptStage>(DEFAULT_SCRIPT_STAGE);
  const stageSelectId = useId();

  return (
    <Modal
      labelledBy="add-script-stage-title"
      onClose={onCancel}
      title="Add script"
      description="Choose the script stage for this row within the current request stage."
    >
      <ModalFormLayout
        actions={
          <Button type="button" onClick={() => onConfirm(stage)}>
            Add script
          </Button>
        }
      >
        <div className="flex flex-col gap-1">
          <label className="text-[14px] font-medium text-text" htmlFor={stageSelectId}>
            Stage
          </label>
          <Select
            id={stageSelectId}
            className="w-full"
            value={stage}
            onChange={(event) => setStage(event.target.value as ScriptStage)}
          >
            {SCRIPT_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}

/**
 * Enable checkbox and inline-editable script label for one script row.
 */
function ScriptRowHeader({
  script,
  snippets,
  onEnabledChange,
  onNameChange
}: ScriptRowHeaderProps): JSX.Element {
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const accessibleLabel = scriptRowLabel(script, snippets);
  const placeholderLabel = scriptRowPlaceholder(script, snippets);
  const stageSuffix = scriptRowStageSuffix(readScriptRefStage(script));
  const isSnippetLinked = script.kind === 'snippet';
  const ariaLabelSuffix = isSnippetLinked ? ' (linked to snippet)' : '';
  const snippetLinkIcon = isSnippetLinked ? (
    <span
      role="img"
      aria-label={SNIPPET_LIBRARY_LABEL}
      title={SNIPPET_LIBRARY_LABEL}
      className="inline-flex shrink-0"
    >
      <FaIcon icon={faTerminal} className={SCRIPT_ROW_SNIPPET_LINK_ICON_CLASS} aria-hidden />
    </span>
  ) : null;

  /**
   * Focuses and selects the label input when inline edit mode opens.
   */
  useEffect(() => {
    if (editingLabel) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [editingLabel]);

  const titleControl = editingLabel ? (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        ref={labelInputRef}
        variant="plain"
        className={`min-w-0 flex-1 border-none bg-transparent p-0 ${SCRIPT_ROW_TITLE_CLASS} outline-none app-no-drag`}
        type="text"
        value={script.name ?? ''}
        onChange={(event) => onNameChange(event.target.value)}
        onBlur={() => setEditingLabel(false)}
        onPointerDown={stopDragPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            setEditingLabel(false);
          }
        }}
        aria-label={`Rename ${accessibleLabel}${ariaLabelSuffix}`}
        placeholder={placeholderLabel}
      />
      {stageSuffix ? (
        <span className="shrink-0" aria-hidden>
          {stageSuffix}
        </span>
      ) : null}
      {snippetLinkIcon}
    </div>
  ) : (
    <button
      type="button"
      className={`flex min-w-0 flex-1 cursor-text items-center gap-1 border-none bg-transparent p-0 text-left ${SCRIPT_ROW_TITLE_CLASS} hover:opacity-80 app-no-drag`}
      aria-label={`Rename ${accessibleLabel}${ariaLabelSuffix}`}
      onClick={() => setEditingLabel(true)}
      onPointerDown={stopDragPointerDown}
    >
      {script.name?.trim() ? (
        <span className="min-w-0 truncate">
          {script.name.trim()}
          {stageSuffix}
        </span>
      ) : (
        <span className="min-w-0 truncate text-muted">
          {placeholderLabel}
          {stageSuffix}
        </span>
      )}
      {snippetLinkIcon}
    </button>
  );

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${SCRIPT_ROW_TITLE_CLASS}`}>
      <input
        type="checkbox"
        checked={script.enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        onPointerDown={stopDragPointerDown}
        aria-label={`Enable ${accessibleLabel}${ariaLabelSuffix}`}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">{titleControl}</div>
    </div>
  );
}

/**
 * Dropdown menu for choosing a snippet from the library.
 */
function SnippetMenu({
  menuId,
  snippets,
  totalSnippetCount,
  phase,
  onSelect,
  onCreate,
  onClose
}: SnippetMenuProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Closes the menu on outside click or Escape.
   */
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      id={menuId}
      role="menu"
      aria-label="Snippet library"
      className="absolute left-0 top-full z-20 mt-0.5 max-h-64 min-w-full overflow-y-auto rounded-lg border border-separator bg-surface py-1 shadow-md app-no-drag"
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full cursor-pointer border-none bg-transparent px-3 py-2 text-left text-[14px] text-text hover:bg-selection app-no-drag"
        onClick={() => {
          onCreate();
          onClose();
        }}
      >
        Create a snippet
      </button>
      <div role="separator" className="my-1 border-t border-separator" aria-hidden="true" />
      {snippets.length === 0 ? (
        <p className="px-3 py-2 text-[14px] text-muted">
          {totalSnippetCount === 0
            ? 'No snippets saved yet'
            : `No snippets saved for the ${phase === 'pre' ? 'pre-request' : 'post-request'} stage yet`}
        </p>
      ) : (
        snippets.map((snippet) => (
          <button
            key={snippet.uuid}
            type="button"
            role="menuitem"
            className="block w-full cursor-pointer border-none bg-transparent px-3 py-2 text-left text-[14px] text-text hover:bg-selection app-no-drag"
            onClick={() => {
              onSelect(snippet.uuid);
              onClose();
            }}
          >
            <span className="block truncate">{snippet.name}</span>
          </button>
        ))
      )}
    </div>
  );
}

/** Accessible labels for bulk enable checkboxes on script group headings. */
const SCRIPT_GROUP_ENABLE_LABELS: Record<ScriptEditorGroup, string> = {
  before: 'Enable all before scripts',
  main: 'Enable all main scripts',
  after: 'Enable all after scripts'
};

/**
 * Returns muted help copy shown under each Before/Main/After group heading.
 *
 * @param group - Editor group for the heading.
 * @param phase - Active request stage tab (`pre` or `post`).
 * @returns One-line description of when scripts in the group run.
 */
function scriptGroupHeadingDescription(group: ScriptEditorGroup, phase: 'pre' | 'post'): string {
  switch (group) {
    case 'before':
      return 'Scripts that run before main';
    case 'main':
      return phase === 'pre'
        ? 'Scripts that run before the request'
        : 'Scripts that run after the request';
    case 'after':
      return 'Scripts that run after main';
  }
}

type ScriptGroupEnabledState = 'all' | 'none' | 'mixed';

/**
 * Derives the bulk-enable checkbox state for one script editor group.
 *
 * @param scripts - Scripts in the before, main, or after group.
 * @returns Whether all, none, or a mix of scripts are enabled.
 */
function scriptGroupEnabledState(scripts: ScriptRef[]): ScriptGroupEnabledState {
  const enabledCount = scripts.filter((script) => script.enabled).length;
  if (enabledCount === 0) {
    return 'none';
  }
  if (enabledCount === scripts.length) {
    return 'all';
  }
  return 'mixed';
}

interface ScriptGroupHeadingProps {
  /**
   * Editor group whose heading and bulk-enable checkbox are rendered.
   */
  group: ScriptEditorGroup;

  /**
   * Active request stage tab used for Main-group help copy.
   */
  phase: 'pre' | 'post';

  /**
   * Scripts in the group used to derive checkbox checked/indeterminate state.
   */
  scripts: ScriptRef[];

  /**
   * Stable id referenced by the parent section `aria-labelledby`.
   */
  headingId: string;

  /**
   * Called when the bulk-enable checkbox toggles all scripts in the group.
   */
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * Renders a Before/Main/After heading with bulk-enable checkbox and help blurb.
 */
function ScriptGroupHeading({
  group,
  phase,
  scripts,
  headingId,
  onEnabledChange
}: ScriptGroupHeadingProps): JSX.Element {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const enabledState = useMemo(() => scriptGroupEnabledState(scripts), [scripts]);
  const checked = enabledState === 'all';
  const descriptionId = `${headingId}-description`;

  /**
   * Reflects mixed enablement across rows via the native indeterminate checkbox state.
   */
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = enabledState === 'mixed';
    }
  }, [enabledState]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          onChange={(event) => onEnabledChange(event.target.checked)}
          aria-label={SCRIPT_GROUP_ENABLE_LABELS[group]}
          aria-describedby={descriptionId}
          className="shrink-0"
        />
        <h3 id={headingId} className="m-0 mt-1 text-[14px] font-medium text-script-group-heading">
          {SCRIPT_EDITOR_GROUP_HEADINGS[group]}
        </h3>
      </div>
      <p id={descriptionId} className="m-0 text-[14px] text-muted">
        {scriptGroupHeadingDescription(group, phase)}
      </p>
    </div>
  );
}

/**
 * Decorative caret between script rows indicating top-to-bottom execution order.
 */
function ScriptFlowArrow(): JSX.Element {
  return (
    <li className="flex list-none justify-center py-1" aria-hidden="true">
      <FaIcon icon={faCaretDown} className="h-4 w-4 text-muted" aria-hidden />
    </li>
  );
}

type ScriptRowCodeEditorProps = {
  /**
   * Stable script row id used to persist editor height.
   */
  scriptId: string;
} & Omit<
  ComponentProps<typeof CodeEditor>,
  | 'height'
  | 'minHeight'
  | 'onHeightChange'
  | 'initialScrollTop'
  | 'initialSelection'
  | 'onViewStateChange'
>;

/**
 * CodeEditor wrapper that restores and persists height, scroll, and selection per script row.
 */
function ScriptRowCodeEditor({ scriptId, ...props }: ScriptRowCodeEditorProps): JSX.Element {
  const { height, onHeightChange, initialScrollTop, initialSelection, onViewStateChange } =
    usePersistedScriptEditorUiState(scriptId, SCRIPT_EDITOR_MIN_HEIGHT);

  return (
    <CodeEditor
      {...props}
      minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
      height={height}
      onHeightChange={onHeightChange}
      initialScrollTop={initialScrollTop}
      initialSelection={initialSelection}
      onViewStateChange={onViewStateChange}
    />
  );
}

/**
 * One sortable script row with a draggable header and expandable editor body.
 */
function SortableScriptRow({
  script,
  snippets,
  label,
  isExpanded,
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
  aiAvailable,
  onAskAi,
  aiSettings,
  hubModelGroups,
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
  const availableModels = getAvailableModels(aiSettings, hubModelGroups);

  const phaseRef = useRef(phase);
  const variablesRef = useRef(variables);
  const hcCompletionSourceRef = useRef<ReturnType<typeof createLiveHcCompletionSource> | null>(
    null
  );

  /**
   * Keeps phase and variables refs aligned and lazily builds the live completion source once.
   */
  useEffect(() => {
    phaseRef.current = phase;
    variablesRef.current = variables;
    hcCompletionSourceRef.current ??= createLiveHcCompletionSource(
      () => phaseRef.current,
      () => variablesRef.current
    );
  }, [phase, variables]);

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
          onCodeChange: handlePatchCode
        }).finally(() => {
          setInlineAskPending(false);
        });
        return;
      }

      setAskTrigger(trigger);
    },
    [aiSettings, availableModels, chatModelId, handlePatchCode, hubModelGroups, phase, script.code]
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
      [{ label: 'Clone', onSelect: onClone }],
      [{ label: 'Delete', variant: 'danger', onSelect: onRemove }]
    ];
  }, [
    canSaveSnippet,
    enterFullScreen,
    isEditingSnippet,
    onClone,
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
    opacity: isDragging ? 0.45 : undefined,
    borderLeftWidth: 2,
    borderLeftColor: scriptStageBorderColor(readScriptRefStage(script))
  };

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
        placeholder={placeholder}
        placeholderHighlight
        variables={variables}
        onEditVariable={onEditVariables}
        aria-label={`${label} source`}
      />
    );
  };

  const editorPanelClassName = editorFill
    ? 'mt-2 flex min-h-0 flex-1 flex-col gap-2'
    : 'mt-2 flex flex-col gap-2';

  return (
    <>
      <li
        ref={setNodeRef}
        style={style}
        className={
          editorFill
            ? 'flex min-h-0 flex-1 flex-col rounded-2xl border border-separator bg-surface px-4 py-3 shadow-sm'
            : 'rounded-2xl border border-separator bg-surface px-4 py-3 shadow-sm'
        }
      >
        <div className={editorFill ? 'flex shrink-0 flex-col gap-0.5' : 'flex flex-col gap-0.5'}>
          <div className="flex min-w-0 items-center gap-3">
            {sortable && !hideDragHandle ? (
              <button
                type="button"
                ref={setActivatorNodeRef}
                className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0 cursor-grab items-center justify-center rounded border-none bg-transparent p-0 text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing app-no-drag`}
                aria-label={reorderLabel}
                title={reorderLabel}
                {...attributes}
                {...listeners}
              >
                <FaIcon icon={faGripVertical} className={SCRIPT_ROW_ICON_CLASS} />
              </button>
            ) : (
              <span
                className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0`}
                aria-hidden="true"
              />
            )}
            <ScriptRowHeader
              script={script}
              snippets={snippets}
              onEnabledChange={onEnabledChange}
              onNameChange={onNameChange}
            />

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto">
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
              <div onPointerDown={stopDragPointerDown}>
                <RowActionsMenu
                  menuId={rowMenuId}
                  openMenuId={openRowMenuId}
                  onOpenChange={onOpenRowMenuChange}
                  groups={rowActionMenuGroups}
                  className={scriptRowIconButtonClass}
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
            <div className="flex gap-3">
              <span
                className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0`}
                aria-hidden="true"
              />
              <div className={`min-w-0 flex-1 ${SCRIPT_ROW_PREVIEW_INDENT_CLASS}`}>
                <CodePreviewTooltip
                  code={resolveScriptSourceCode(script, snippets)}
                  actionLabel={`Expand ${label}`}
                  onClick={onToggleExpanded}
                  onPointerDown={stopDragPointerDown}
                />
              </div>
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
      </li>

      <div
        ref={fullScreenHostRef}
        className={isFullScreen ? 'flex h-full w-full min-h-0 flex-col bg-surface p-4' : 'hidden'}
        aria-hidden={!isFullScreen}
      >
        {isFullScreen ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
              <h2
                id={fullScreenTitleId}
                className="m-0 min-w-0 truncate text-[16px] font-medium text-text"
              >
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
  const scriptEditorActions = usePluginScriptEditorActions(phase);
  const normalized = useMemo(() => normalizeScriptRefs(scripts), [scripts]);
  const scriptGroups = useMemo(() => splitScriptRefsByGroup(normalized), [normalized]);
  const compatibleSnippets = useMemo(
    () => snippets.filter((snippet) => snippetMatchesPhase(snippet.scope, phase)),
    [snippets, phase]
  );
  const sortableEnabled = normalized.length > 1;
  const [activeDragScriptId, setActiveDragScriptId] = useState<string | null>(null);
  const [addScriptStageModalOpen, setAddScriptStageModalOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);
  const [saveSnippetTarget, setSaveSnippetTarget] = useState<{
    scriptId: string;
    code: string;
  } | null>(null);
  const [saveSnippetSaving, setSaveSnippetSaving] = useState(false);
  const [saveSnippetError, setSaveSnippetError] = useState<string | null>(null);
  const [createSnippetDraft, setCreateSnippetDraft] = useState<SnippetEditDraft | null>(null);
  const [createSnippetSaving, setCreateSnippetSaving] = useState(false);
  const [createSnippetError, setCreateSnippetError] = useState<string | null>(null);
  const snippetMenuId = useId();

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
  const handleSnippetSelect = (uuid: string): void => {
    const trimmedUuid = uuid.trim();
    if (!trimmedUuid) {
      return;
    }
    const snippet = snippets.find((entry) => entry.uuid === trimmedUuid);
    const created = {
      ...createSnippetScriptRef(trimmedUuid, snippet?.name, snippet?.stage ?? DEFAULT_SCRIPT_STAGE),
      expanded: true
    };
    const groups = splitScriptRefsByGroup(normalized);
    const group = scriptStageGroup(normalizeScriptStage(created.stage));
    updateScripts(
      mergeScriptRefGroups({
        ...groups,
        [group]: [...groups[group], created]
      })
    );
  };

  /**
   * Opens the create-snippet modal from the snippet library menu.
   */
  const openCreateSnippetModal = (): void => {
    setCreateSnippetDraft(createBlankSnippet(snippetScopeForPhase(phase)));
    setCreateSnippetError(null);
    setSnippetMenuOpen(false);
  };

  /**
   * Reads a `.js` file and opens the create-snippet modal with imported source.
   */
  const handleImportSnippet = async (): Promise<void> => {
    try {
      const result = await window.api.importSnippetFile();
      if (!result) {
        return;
      }

      setCreateSnippetDraft(createImportedSnippetDraft(result.code, snippetScopeForPhase(phase)));
      setCreateSnippetError(null);
      setSnippetMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import snippet');
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
    dispatch(setShowAiSidebar(true));
    await dispatch(createNewChat(aiSettings));
    dispatch(setPendingComposerText(`@${requestId ?? 'active'}.${phase}.${scriptIndex}\n\n`));
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
    aiAvailable,
    onAskAi: () => void handleAskAi(scriptIndex + 1),
    aiSettings,
    hubModelGroups,
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
      <Button
        type="button"
        variant="secondary"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
        aria-label="Import JavaScript snippet"
        onClick={() => void handleImportSnippet()}
      >
        <FaIcon icon={faFileImport} className="h-3.5 w-3.5" />
        Import
      </Button>
      <div className="flex shrink-0 items-center gap-2 mr-4">
        <div className="relative">
          <Button
            type="button"
            variant="secondary"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
            aria-haspopup="menu"
            aria-expanded={snippetMenuOpen}
            aria-controls={snippetMenuOpen ? snippetMenuId : undefined}
            onClick={() => setSnippetMenuOpen((open) => !open)}
          >
            <FaIcon icon={faTerminal} className="h-3.5 w-3.5" aria-hidden />
            Snippets
          </Button>
          {snippetMenuOpen ? (
            <SnippetMenu
              menuId={snippetMenuId}
              snippets={compatibleSnippets}
              totalSnippetCount={snippets.length}
              phase={phase}
              onSelect={handleSnippetSelect}
              onCreate={openCreateSnippetModal}
              onClose={() => setSnippetMenuOpen(false)}
            />
          ) : null}
        </div>
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
          <FaIcon
            icon={allScriptsExpanded ? faAnglesUp : faAnglesDown}
            className="h-4 w-4"
            aria-hidden
          />
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
        <p className="m-0 text-[14px] text-muted">
          Scripts run in order within each group. Drag to reorder inside a group.
        </p>
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
          <div className="rounded-2xl border border-separator bg-surface px-4 py-2 text-[14px] font-medium shadow-md">
            {scriptRowLabel(activeDragScript, snippets)}
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
