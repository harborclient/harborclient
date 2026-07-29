import { Button, FaIcon } from '@harborclient/sdk/components';
import type { WorkflowToolbarActionContext } from '@harborclient/sdk';
import type { JSX } from 'react';
import { faFloppyDisk, faTrash } from '#/renderer/src/fontawesome';
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
   * When true, shows Delete / Save host buttons (edit mode only).
   */
  showHostEditButtons: boolean;

  /**
   * Context passed to plugin toolbar command handlers.
   */
  toolbarContext: WorkflowToolbarActionContext;

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
 * Edit controls and plugin toolbar actions for the workflow footer panel.
 *
 * Host delete/save buttons render only when {@link Props.showHostEditButtons} is
 * true. Plugin toolbar contributions always render when registered.
 *
 * @param props - Selection state, plugin toolbar context, and edit handlers.
 * @returns Edit control button group, or null when nothing to show.
 */
export function WorkflowEditControls({
  playing,
  actionIndex,
  actionCount,
  dirty,
  saving,
  showHostEditButtons,
  toolbarContext,
  onDelete,
  onSave
}: Props): JSX.Element | null {
  const hasActiveAction = actionIndex >= 0 && actionIndex < actionCount;
  const canDelete = hasActiveAction;
  const toolbarActions = usePluginWorkflowToolbarActions();

  if (!showHostEditButtons && toolbarActions.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 border-l border-separator pl-3"
      role="group"
      aria-label={showHostEditButtons ? 'Edit workflow action' : 'Workflow plugin actions'}
    >
      {showHostEditButtons ? (
        <>
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
            disabled={!dirty || playing || saving}
            onClick={onSave}
            aria-label="Save workflow"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
              Save
            </span>
          </Button>
        </>
      ) : null}
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
