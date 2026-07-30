import { Button, FaIcon } from '@harborclient/sdk/components';
import type { WorkflowToolbarActionContext } from '@harborclient/sdk';
import type { JSX } from 'react';
import { faFloppyDisk, faXmark } from '#/renderer/src/fontawesome';
import { usePluginWorkflowToolbarActions } from '#/renderer/src/plugins/pluginHooks';

interface Props {
  /**
   * True while the play loop is actively dispatching actions.
   */
  playing: boolean;

  /**
   * True when the playback buffer has unsaved edits.
   */
  dirty: boolean;

  /**
   * True while an explicit save is in flight.
   */
  saving: boolean;

  /**
   * When true, shows Save (and optional Cancel) host buttons (edit mode only).
   */
  showHostEditButtons: boolean;

  /**
   * When true, shows Cancel to abandon edit and return to play mode.
   */
  showCancel: boolean;

  /**
   * Context passed to plugin toolbar command handlers.
   */
  toolbarContext: WorkflowToolbarActionContext;

  /**
   * Persists the current playback buffer to the workflow registry.
   */
  onSave: () => void;

  /**
   * Discards edit-from-play and returns the panel to play mode.
   */
  onCancel: () => void;
}

/**
 * Edit controls and plugin toolbar actions for the workflow footer panel.
 *
 * Host save/cancel buttons render only when {@link Props.showHostEditButtons} is
 * true. Cancel renders with those host buttons when {@link Props.showCancel} is
 * true. Plugin toolbar contributions always render when registered. Action
 * deletion lives on the timeline context menu and the payload editor modal.
 *
 * @param props - Dirty/saving state, plugin toolbar context, and edit handlers.
 * @returns Edit control button group, or null when nothing to show.
 */
export function WorkflowEditControls({
  playing,
  dirty,
  saving,
  showHostEditButtons,
  showCancel,
  toolbarContext,
  onSave,
  onCancel
}: Props): JSX.Element | null {
  const toolbarActions = usePluginWorkflowToolbarActions();

  if (!showHostEditButtons && toolbarActions.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 border-l border-separator pl-3"
      role="group"
      aria-label={showHostEditButtons ? 'Edit workflow' : 'Workflow plugin actions'}
    >
      {showHostEditButtons ? (
        <>
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
          {showCancel ? (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={playing || saving}
              onClick={onCancel}
              aria-label="Cancel editing"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <FaIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </span>
            </Button>
          ) : null}
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
