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
import { Button, CodeEditor, FaIcon, Input } from '@harborclient/sdk/components';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { ScriptRef, Snippet, Variable } from '#/shared/types';
import {
  createInlineScriptRef,
  createSnippetScriptRef,
  ensureDefaultScriptRef,
  normalizeScriptRefs
} from '#/shared/scriptRefs';
import { createHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faChevronDown, faChevronUp, faGripVertical, faTrash } from '#/renderer/src/fontawesome';

const SCRIPT_EDITOR_MIN_HEIGHT = '125px';
const DEFAULT_NEW_SCRIPT_NAME = 'Unnamed script...';

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
}

interface SnippetMenuProps {
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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-text">
      <input
        type="checkbox"
        checked={script.enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        onPointerDown={stopDragPointerDown}
        aria-label={`Enable ${accessibleLabel}`}
      />
      {editingLabel ? (
        <Input
          ref={labelInputRef}
          variant="plain"
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[14px] font-medium text-text outline-none app-no-drag"
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
          aria-label="Script label"
          placeholder={placeholderLabel}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 cursor-text border-none bg-transparent p-0 text-left text-[14px] font-medium text-text hover:opacity-80 app-no-drag"
          onClick={() => setEditingLabel(true)}
          onPointerDown={stopDragPointerDown}
        >
          {script.name?.trim() ? (
            <span className="truncate">{script.name.trim()}</span>
          ) : (
            <span className="truncate text-muted">{placeholderLabel}</span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Dropdown menu for choosing a snippet from the library.
 */
function SnippetMenu({ snippets, onSelect, onClose }: SnippetMenuProps): JSX.Element {
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
      role="menu"
      aria-label="Snippet library"
      className="absolute left-0 top-full z-20 mt-0.5 max-h-64 min-w-full overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md app-no-drag"
    >
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
  onPatchCode
}: SortableScriptRowProps): JSX.Element {
  const snippet =
    script.kind === 'snippet'
      ? snippets.find((entry) => entry.uuid === script.snippetUuid)
      : undefined;

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
      <div
        ref={sortable ? setActivatorNodeRef : undefined}
        className={
          sortable
            ? 'flex cursor-grab flex-wrap items-center gap-3 active:cursor-grabbing'
            : 'flex flex-wrap items-center gap-3'
        }
        aria-label={sortable ? `Reorder script "${label}"` : undefined}
        {...(sortable ? attributes : {})}
        {...(sortable ? listeners : {})}
      >
        <FaIcon icon={faGripVertical} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <ScriptRowHeader
          script={script}
          snippets={snippets}
          onEnabledChange={onEnabledChange}
          onNameChange={onNameChange}
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="icon"
            aria-label={`Remove ${label}`}
            onPointerDown={stopDragPointerDown}
            onClick={onRemove}
          >
            <FaIcon icon={faTrash} />
          </Button>
          <Button
            type="button"
            variant="icon"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
            onPointerDown={stopDragPointerDown}
            onClick={onToggleExpanded}
          >
            <FaIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </Button>
        </div>
      </div>

      {isExpanded && script.kind === 'inline' && (
        <div className="mt-3 flex flex-col gap-2">
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
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[14px] text-muted">
            Live reference to snippet{' '}
            <span className="font-medium text-text">{snippet?.name ?? 'Unknown snippet'}</span>.
            Editing the snippet in Settings updates every request using it.
          </p>
          <CodeEditor
            readOnly
            value={snippet?.code ?? '// Snippet not found'}
            language="javascript"
            minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
            aria-label={`${label} preview`}
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
  placeholder
}: Props): JSX.Element {
  const confirm = useConfirm();
  const normalized = useMemo(() => normalizeScriptRefs(scripts), [scripts]);
  const sortableEnabled = normalized.length > 1;
  const [activeDragScriptId, setActiveDragScriptId] = useState<string | null>(null);
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);

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
    const created = { ...createInlineScriptRef('', DEFAULT_NEW_SCRIPT_NAME), expanded: true };
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
   * Renders add controls shared below the script list.
   */
  const addControls = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 mt-2">
      <Button
        type="button"
        className="shrink-0 whitespace-nowrap rounded-full!"
        onClick={handleAddInline}
      >
        Add
      </Button>
      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          className="w-[170px] shrink-0 gap-1 whitespace-nowrap rounded-full!"
          aria-haspopup="menu"
          aria-expanded={snippetMenuOpen}
          disabled={snippets.length === 0}
          onClick={() => setSnippetMenuOpen((open) => !open)}
        >
          Select snippet...
          <FaIcon icon={faChevronDown} aria-hidden />
        </Button>
        {snippetMenuOpen ? (
          <SnippetMenu
            snippets={snippets}
            onSelect={handleSnippetSelect}
            onClose={() => setSnippetMenuOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );

  /**
   * Renders the multi-script list, optionally wrapped in drag-and-drop context.
   */
  const scriptList = (
    <ul className="flex flex-col gap-3" aria-label={`${phase} request scripts`}>
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
            phase={phase}
            placeholder={placeholder}
            variables={variables}
            onEditVariables={onEditVariables}
            sortable={sortableEnabled}
            onEnabledChange={(enabled) => patchScript(script.id, { enabled })}
            onNameChange={(name) => patchScript(script.id, { name })}
            onRemove={() => void handleRemoveScript(script.id, label)}
            onToggleExpanded={() => patchScript(script.id, { expanded: !isExpanded })}
            onPatchCode={(code) => patchScript(script.id, { code })}
          />
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3">
      {sortableEnabled ? (
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
      )}

      {addControls}
    </div>
  );
}
