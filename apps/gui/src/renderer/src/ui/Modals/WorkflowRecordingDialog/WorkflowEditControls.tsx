import { Button, FaIcon } from '@harborclient/sdk/components';
import type { WorkflowToolbarActionContext } from '@harborclient/sdk';
import type { JSX } from 'react';
import { faAngleLeft, faAngleRight, faFloppyDisk, faTrash } from '#/renderer/src/fontawesome';
import { usePluginWorkflowToolbarActions } from '#/renderer/src/plugins/pluginHooks';

interface Props {
  /**
   * True while the play loop is actively dispatching actions.
   */
  playing: boolean;

  /**
   * Current 0-based action cursor (active action).
   */
  actionIndex: number;

  /**
   * Total actions in the loaded workflow.
   */
  actionCount: number;

  /**
   * True when the playback buffer has unsaved edits.
   */
  dirty: boolean;

  /**
   * True while an explicit save is in flight.
   */
  saving: boolean;

  /**
   * Context passed to plugin toolbar command handlers.
   */
  toolbarContext: WorkflowToolbarActionContext;

  /**
   * Moves the active action one step earlier in the timeline.
   */
  onMoveAhead: () => void;

  /**
   * Moves the active action one step later in the timeline.
   */
  onMoveBehind: () => void;

  /**
   * Prompts to delete the active action from the workflow.
   */
  onDelete: () => void;

  /**
   * Persists the current playback buffer to the workflow registry.
   */
  onSave: () => void;
}

/**
 * Edit controls for the active workflow timeline action (delete, move, save).
 *
 * Rendered as a visually separate group beside the transport controls. Edits stay
 * local until the user clicks Save. Plugin {@link usePluginWorkflowToolbarActions}
 * buttons render to the right of Save.
 *
 * @param props - Selection state, plugin toolbar context, and edit handlers.
 * @returns Edit control button group.
 */
export function WorkflowEditControls({
  playing,
  actionIndex,
  actionCount,
  dirty,
  saving,
  toolbarContext,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onSave
}: Props): JSX.Element {
  const hasActiveAction = actionIndex >= 0 && actionIndex < actionCount;
  const canMoveAhead = hasActiveAction && actionIndex > 0;
  const canMoveBehind = hasActiveAction && actionIndex < actionCount - 1;
  const canDelete = hasActiveAction;
  const toolbarActions = usePluginWorkflowToolbarActions();

  return (
    <div
      className="flex items-center gap-2 border-l border-separator pl-3"
      role="group"
      aria-label="Edit workflow action"
    >
      <Button
        type="button"
        variant="secondaryDanger"
        className="shrink-0"
        disabled={playing || !canDelete}
        onClick={onDelete}
        aria-label="Delete action"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden />
          Delete
        </span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0"
        disabled={playing || !canMoveAhead}
        onClick={onMoveAhead}
        aria-label="Move ahead"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" aria-hidden />
          Move ahead
        </span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0"
        disabled={playing || !canMoveBehind}
        onClick={onMoveBehind}
        aria-label="Move behind"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={faAngleRight} className="h-3.5 w-3.5" aria-hidden />
          Move behind
        </span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0"
        disabled={!dirty || playing || saving}
        onClick={onSave}
        aria-label="Save workflow"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
          Save
        </span>
      </Button>
      {toolbarActions.map((action) => (
        <Button
          key={`${action.pluginId}:${action.id}`}
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={playing}
          title={action.title}
          aria-label={action.title}
          onClick={() => {
            void window.api.executePluginAgentCommand(action.pluginId, action.command, [
              toolbarContext
            ]);
          }}
        >
          {action.title}
        </Button>
      ))}
    </div>
  );
}
