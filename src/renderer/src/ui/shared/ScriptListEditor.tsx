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
  ModalFormLayout
} from '@harborclient/sdk/components';
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react';
import toast from 'react-hot-toast';
import type { ScriptRef, Snippet, Variable } from '#/shared/types';
import {
  createInlineScriptRef,
  createSnippetScriptRef,
  ensureDefaultScriptRef,
  linkScriptRefToSnippet,
  normalizeScriptRefs,
  resolveScriptSourceCode,
  UNNAMED_SCRIPT_NAME
} from '#/shared/scriptRefs';
import { CodePreviewTooltip, buildCodePreview } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import {
  createBlankSnippet,
  SnippetEditModal,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/SnippetEditModal';
import { scriptRowIconButtonClass } from '#/renderer/src/ui/shared/classes';
import {
  normalizeEditorPlaceholder,
  REQUEST_SCRIPTS_HELP_URL
} from '#/renderer/src/ui/shared/scriptPlaceholders';
import { createHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { setPendingComposerText } from '#/renderer/src/store/slices/aiChatSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { createSnippet, updateSnippet } from '#/renderer/src/store/thunks/snippets';
import {
  faAnglesDown,
  faAnglesUp,
  faCaretDown,
  faChevronDown,
  faChevronUp,
  faFloppyDisk,
  faGripVertical,
  faTrash,
  faArrowUpRightFromSquare,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';

const SCRIPT_EDITOR_MIN_HEIGHT = '125px';

/** Title and label typography for script row headers. */
const SCRIPT_ROW_TITLE_CLASS = 'text-[15px] font-medium text-text';

/** Icon size shared by drag handle and row action buttons. */
const SCRIPT_ROW_ICON_CLASS = 'h-4 w-4';

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
  onEditVariables?: () => void;

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
  onEditVariables?: () => void;

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
   * Whether AI chat is available for this user.
   */
  aiAvailable: boolean;

  /**
   * Opens the AI sidebar with a fresh chat prefilled for this script row.
   */
  onAskAi: () => void;
}

interface SaveSnippetNameModalProps {
  /**
   * Default snippet name shown in the input.
   */
  defaultName: string;

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
   * Persists the snippet under the entered name.
   *
   * @param name - Trimmed snippet name from the modal input.
   */
  onSave: (name: string) => void;
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
 * Stops pointer events from bubbling to the drag activator on header controls.
 *
 * @param event - Pointer event from a nested interactive control.
 */
function stopDragPointerDown(event: ReactPointerEvent): void {
  event.stopPropagation();
}

/**
 * Renders a label for one script reference row.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Display label for the row header.
 */
function scriptRowLabel(script: ScriptRef, snippets: Snippet[]): string {
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
  saving,
  error,
  onCancel,
  onSave
}: SaveSnippetNameModalProps): JSX.Element {
  const [name, setName] = useState(defaultName);
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
          <Button type="button" disabled={saving} onClick={() => onSave(name)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
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
                onSave(name);
              }
            }}
            placeholder="Snippet name"
          />
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
      aria-label={`Rename ${accessibleLabel}`}
      placeholder={placeholderLabel}
    />
  ) : (
    <button
      type="button"
      className={`min-w-0 flex-1 cursor-text border-none bg-transparent p-0 text-left ${SCRIPT_ROW_TITLE_CLASS} hover:opacity-80 app-no-drag`}
      aria-label={`Rename ${accessibleLabel}`}
      onClick={() => setEditingLabel(true)}
      onPointerDown={stopDragPointerDown}
    >
      {script.name?.trim() ? (
        <span className="truncate">{script.name.trim()}</span>
      ) : (
        <span className="truncate text-muted">{placeholderLabel}</span>
      )}
    </button>
  );

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${SCRIPT_ROW_TITLE_CLASS}`}>
      <input
        type="checkbox"
        checked={script.enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        onPointerDown={stopDragPointerDown}
        aria-label={`Enable ${accessibleLabel}`}
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
      className="absolute left-0 top-full z-20 mt-0.5 max-h-64 min-w-full overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md app-no-drag"
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
        <p className="px-3 py-2 text-[14px] text-muted">No snippets saved yet</p>
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
  aiAvailable,
  onAskAi
}: SortableScriptRowProps): JSX.Element {
  const snippet =
    script.kind === 'snippet'
      ? snippets.find((entry) => entry.uuid === script.snippetUuid)
      : undefined;
  const librarySnippetCode = snippet?.code ?? '';
  const snippetRevision = `${script.snippetUuid ?? ''}:${snippet?.updated_at ?? ''}`;
  const [snippetDraftCode, setSnippetDraftCode] = useState(librarySnippetCode);
  const [snippetRevisionSeen, setSnippetRevisionSeen] = useState(snippetRevision);
  const saveSnippetCode = script.kind === 'inline' ? (script.code ?? '') : snippetDraftCode;
  const canSaveSnippet = Boolean(saveSnippetCode.trim());
  const saveSnippetLabel =
    script.kind === 'snippet' ? `Save snippet "${label}"` : `Save "${label}" as snippet`;
  const editorPanelId = useId();
  const showCodePreview =
    !isExpanded && Boolean(buildCodePreview(resolveScriptSourceCode(script, snippets)));

  if (snippetRevision !== snippetRevisionSeen) {
    setSnippetRevisionSeen(snippetRevision);
    setSnippetDraftCode(librarySnippetCode);
  }

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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-separator bg-surface px-4 py-3 shadow-sm"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3">
          {sortable ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0 cursor-grab items-center justify-center rounded border-none bg-transparent p-0 text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing app-no-drag`}
              aria-label={`Reorder script "${label}"`}
              {...attributes}
              {...listeners}
            >
              <FaIcon icon={faGripVertical} className={SCRIPT_ROW_ICON_CLASS} />
            </button>
          ) : (
            <span className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0`} aria-hidden="true" />
          )}
          <ScriptRowHeader
            script={script}
            snippets={snippets}
            onEnabledChange={onEnabledChange}
            onNameChange={onNameChange}
          />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {aiAvailable ? (
              <Button
                type="button"
                variant="icon"
                className={scriptRowIconButtonClass}
                aria-label={`Ask AI about ${label}`}
                onPointerDown={stopDragPointerDown}
                onClick={onAskAi}
              >
                <FaIcon icon={faWandMagicSparkles} className={SCRIPT_ROW_ICON_CLASS} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="icon"
              className={scriptRowIconButtonClass}
              aria-label={saveSnippetLabel}
              disabled={!canSaveSnippet}
              onPointerDown={stopDragPointerDown}
              onClick={() => onSaveSnippet(saveSnippetCode)}
            >
              <FaIcon icon={faFloppyDisk} className={SCRIPT_ROW_ICON_CLASS} />
            </Button>
            <Button
              type="button"
              variant="icon"
              className={scriptRowIconButtonClass}
              aria-label={`Remove ${label}`}
              onPointerDown={stopDragPointerDown}
              onClick={onRemove}
            >
              <FaIcon icon={faTrash} className={SCRIPT_ROW_ICON_CLASS} />
            </Button>
            <Button
              type="button"
              variant="icon"
              className={scriptRowIconButtonClass}
              aria-controls={editorPanelId}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
              onPointerDown={stopDragPointerDown}
              onClick={onToggleExpanded}
            >
              <FaIcon
                icon={isExpanded ? faChevronUp : faChevronDown}
                className={SCRIPT_ROW_ICON_CLASS}
              />
            </Button>
          </div>
        </div>

        {showCodePreview ? (
          <div className="flex gap-3">
            <span className={`inline-flex ${SCRIPT_ROW_ICON_CLASS} shrink-0`} aria-hidden="true" />
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

      {isExpanded && script.kind === 'inline' && (
        <div
          id={editorPanelId}
          role="region"
          aria-label={`${label} source editor`}
          className="mt-2 flex flex-col gap-2"
        >
          <CodeEditor
            value={script.code ?? ''}
            onChange={onPatchCode}
            language="javascript"
            completionSource={createHcCompletionSource(phase, variables)}
            placeholder={placeholder}
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
            aria-label={`${label} source`}
          />
        </div>
      )}

      {isExpanded && script.kind === 'snippet' && (
        <div
          id={editorPanelId}
          role="region"
          aria-label={`${label} source editor`}
          className="mt-2 flex flex-col gap-2"
        >
          <CodeEditor
            value={snippetDraftCode}
            onChange={setSnippetDraftCode}
            language="javascript"
            completionSource={createHcCompletionSource(phase, variables)}
            placeholder={placeholder}
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
            aria-label={`${label} source`}
          />
        </div>
      )}
    </li>
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
  requestId
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const normalized = useMemo(() => normalizeScriptRefs(scripts), [scripts]);
  const sortableEnabled = normalized.length > 1;
  const [activeDragScriptId, setActiveDragScriptId] = useState<string | null>(null);
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
   * Stable sortable ids for script rows.
   */
  const scriptIds = useMemo(() => normalized.map((script) => script.id), [normalized]);

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
   * Replaces the script list with a normalized copy.
   *
   * @param next - Updated script references.
   */
  const updateScripts = (next: ScriptRef[]): void => {
    onChange(normalizeScriptRefs(next));
  };

  /**
   * Adds a new empty inline script at the end of the list.
   */
  const handleAddInline = (): void => {
    const created = { ...createInlineScriptRef('', UNNAMED_SCRIPT_NAME), expanded: true };
    updateScripts([...normalized, created]);
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
    const created = { ...createSnippetScriptRef(trimmedUuid, snippet?.name), expanded: true };
    updateScripts([...normalized, created]);
  };

  /**
   * Opens the create-snippet modal from the snippet library menu.
   */
  const openCreateSnippetModal = (): void => {
    setCreateSnippetDraft(createBlankSnippet());
    setCreateSnippetError(null);
    setSnippetMenuOpen(false);
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
        createSnippet({ name: trimmedName, code: createSnippetDraft.code })
      ).unwrap();
      toast.success('Snippet created');
      updateScripts([
        ...normalized,
        { ...createSnippetScriptRef(created.uuid, created.name), expanded: true }
      ]);
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
  const handleConfirmSaveSnippet = async (name: string): Promise<void> => {
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
        const created = await dispatch(createSnippet({ name: trimmedName, code })).unwrap();
        replaceScript(script.id, linkScriptRefToSnippet(script, created.uuid, trimmedName));
        toast.success('Snippet saved');
        closeSaveSnippetModal();
        return;
      }

      if (trimmedName === linkedSnippet.name.trim()) {
        await dispatch(updateSnippet({ id: linkedSnippet.id, name: trimmedName, code })).unwrap();
        patchScript(script.id, { name: trimmedName });
        toast.success('Snippet saved');
        closeSaveSnippetModal();
        return;
      }

      const created = await dispatch(createSnippet({ name: trimmedName, code })).unwrap();
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
   * Prompts before removing a script row, then updates the list when confirmed.
   *
   * @param id - Script list entry id.
   * @param label - Display label shown in the confirmation message.
   */
  const handleRemoveScript = async (id: string, label: string): Promise<void> => {
    const phaseLabel = phase === 'pre' ? 'pre-request' : 'post-request';
    const confirmed = await confirm({
      title: 'Remove script',
      message: `Remove "${label}" from the ${phaseLabel} scripts?`,
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    removeScript(id);
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
   * Renders add controls aligned to the right of the script list header.
   */
  const addControls = (
    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
      <Button
        type="button"
        className="shrink-0 whitespace-nowrap rounded-full!"
        onClick={handleAddInline}
      >
        Add
      </Button>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2 whitespace-nowrap rounded-full!"
            aria-haspopup="menu"
            aria-expanded={snippetMenuOpen}
            aria-controls={snippetMenuOpen ? snippetMenuId : undefined}
            onClick={() => setSnippetMenuOpen((open) => !open)}
          >
            Snippet library...
            <FaIcon icon={faChevronDown} aria-hidden />
          </Button>
          {snippetMenuOpen ? (
            <SnippetMenu
              menuId={snippetMenuId}
              snippets={snippets}
              onSelect={handleSnippetSelect}
              onCreate={openCreateSnippetModal}
              onClose={() => setSnippetMenuOpen(false)}
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 rounded-full!"
          aria-label={allScriptsExpanded ? 'Collapse all scripts' : 'Expand all scripts'}
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
        <p className="m-0 text-[14px] text-muted">Scripts run in order. Drag to reorder.</p>
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
   * Renders the ordered script row list.
   */
  const scriptList = (
    <ul className="flex flex-col" aria-label={`${phase} request scripts`}>
      {normalized.map((script, index) => {
        const label = scriptRowLabel(script, snippets);
        const isExpanded = script.expanded ?? false;

        return (
          <Fragment key={script.id}>
            <SortableScriptRow
              script={script}
              snippets={snippets}
              label={label}
              isExpanded={isExpanded}
              phase={phase}
              placeholder={editorPlaceholder}
              variables={variables}
              onEditVariables={onEditVariables}
              sortable={sortableEnabled}
              onEnabledChange={(enabled) => patchScript(script.id, { enabled })}
              onNameChange={(name) => patchScript(script.id, { name })}
              onRemove={() => void handleRemoveScript(script.id, label)}
              onToggleExpanded={() => patchScript(script.id, { expanded: !isExpanded })}
              onPatchCode={(code) => patchScript(script.id, { code })}
              onSaveSnippet={(code) => openSaveSnippetModal(script.id, code)}
              aiAvailable={aiAvailable}
              onAskAi={() => void handleAskAi(index + 1)}
            />
            {index < normalized.length - 1 ? <ScriptFlowArrow /> : null}
          </Fragment>
        );
      })}
    </ul>
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
      <SortableContext items={scriptIds} strategy={verticalListSortingStrategy}>
        {scriptList}
      </SortableContext>
      <DragOverlay>
        {activeDragScript ? (
          <div className="rounded-lg border border-separator bg-surface px-4 py-2 text-[14px] font-medium shadow-md">
            {scriptRowLabel(activeDragScript, snippets)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  ) : (
    scriptList
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {scriptListHeader}
      <div className="hc-scroll-stable flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
        {scriptListBody}
      </div>

      {saveSnippetTarget && saveSnippetScript ? (
        <SaveSnippetNameModal
          key={saveSnippetTarget.scriptId}
          defaultName={saveSnippetDefaultName(saveSnippetScript, snippets)}
          saving={saveSnippetSaving}
          error={saveSnippetError}
          onCancel={closeSaveSnippetModal}
          onSave={(name) => void handleConfirmSaveSnippet(name)}
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
    </div>
  );
}
