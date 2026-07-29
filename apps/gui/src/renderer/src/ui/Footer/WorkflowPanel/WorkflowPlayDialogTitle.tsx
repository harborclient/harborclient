import { FaIcon, Input } from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { faPen } from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { renameWorkflow } from '#/renderer/src/store/thunks/workflows';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

interface Props {
  /**
   * Persisted workflow id to rename.
   */
  workflowId: number;

  /**
   * Current workflow display name from the store.
   */
  name: string;

  /**
   * Element id for the dialog title / `aria-labelledby`.
   */
  titleId: string;
}

/**
 * Stops pointer events from bubbling while interacting with the editable title.
 *
 * @param event - Pointer event from the title control.
 */
function stopDragPointerDown(event: ReactPointerEvent): void {
  event.stopPropagation();
}

/**
 * Inline-editable workflow name for the footer panel header.
 * Matches the request breadcrumb pattern: click the name or pen icon to edit;
 * blur or Enter persists; Escape cancels.
 */
export function WorkflowPlayDialogTitle({ workflowId, name, titleId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Focuses and selects the name input when inline edit mode opens.
   */
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  /**
   * Opens inline edit mode with the current stored name.
   */
  const startEditing = useCallback((): void => {
    setDraftName(name);
    setError(null);
    setEditing(true);
  }, [name]);

  /**
   * Commits the draft name on blur/Enter, or reverts when empty/unchanged/Escape.
   *
   * @param commit - When true, persist a non-empty changed name; otherwise cancel.
   */
  const finishEditing = useCallback(
    async (commit: boolean): Promise<void> => {
      if (saving) {
        return;
      }

      if (!commit) {
        setDraftName(name);
        setError(null);
        setEditing(false);
        return;
      }

      const trimmed = draftName.trim();
      if (!trimmed) {
        setDraftName(name);
        setError(null);
        setEditing(false);
        return;
      }

      if (trimmed === name) {
        setDraftName(name);
        setError(null);
        setEditing(false);
        return;
      }

      setSaving(true);
      setError(null);
      try {
        await dispatch(renameWorkflow({ id: workflowId, name: trimmed })).unwrap();
        setEditing(false);
      } catch (err) {
        setDraftName(name);
        setError(formatErrorMessage(err, 'Failed to rename workflow'));
        setEditing(false);
      } finally {
        setSaving(false);
      }
    },
    [dispatch, draftName, name, saving, workflowId]
  );

  return (
    <div className="min-w-0">
      {editing ? (
        <Input
          ref={inputRef}
          id={titleId}
          variant="plain"
          aria-label="Workflow name"
          aria-invalid={error != null}
          aria-describedby={error != null ? `${titleId}-error` : undefined}
          className="app-no-drag w-full min-w-0 border-none bg-transparent p-0 text-[15px] font-semibold text-text outline-none"
          type="text"
          value={draftName}
          disabled={saving}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            void finishEditing(true);
          }}
          onPointerDown={stopDragPointerDown}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void finishEditing(true);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              void finishEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          id={titleId}
          aria-label={`Rename workflow: ${name}`}
          title="Rename workflow"
          className="app-no-drag inline-flex max-w-full min-w-0 cursor-text items-center border-none bg-transparent p-0 text-left text-[15px] font-semibold text-text hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          onClick={startEditing}
          onPointerDown={stopDragPointerDown}
        >
          <span className="min-w-0 truncate">{name}</span>
          <FaIcon
            icon={faPen}
            className="ms-2 h-2 w-2 shrink-0 cursor-pointer text-muted opacity-60"
            aria-hidden
          />
        </button>
      )}
      {error != null ? (
        <p id={`${titleId}-error`} className="mt-0.5 truncate text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
