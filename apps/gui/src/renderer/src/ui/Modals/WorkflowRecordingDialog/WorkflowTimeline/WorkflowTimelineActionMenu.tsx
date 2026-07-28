import { TabContextMenu, type MenuItem } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  canMoveWorkflowAction,
  type WorkflowActionMoveDirection
} from '#/renderer/src/workflows/workflowActionEdits';

interface Props {
  /**
   * Action index the menu was opened for.
   */
  actionIndex: number;

  /**
   * Total actions in the workflow.
   */
  actionCount: number;

  /**
   * True while playback is running (all edits disabled).
   */
  playing: boolean;

  /**
   * Cursor position where the context menu should appear.
   */
  position: { x: number; y: number };

  /**
   * Moves the targeted action one step earlier.
   */
  onMoveAhead: () => void;

  /**
   * Moves the targeted action one step later.
   */
  onMoveBehind: () => void;

  /**
   * Deletes the targeted action after confirmation.
   */
  onDelete: () => void;

  /**
   * Closes the menu without selecting an item.
   */
  onClose: () => void;
}

/**
 * Context menu for a workflow timeline action (move ahead/behind, delete).
 *
 * @param props - Target index, disable state, handlers, and anchor position.
 * @returns Cursor-positioned context menu.
 */
export function WorkflowTimelineActionMenu({
  actionIndex,
  actionCount,
  playing,
  position,
  onMoveAhead,
  onMoveBehind,
  onDelete,
  onClose
}: Props): JSX.Element {
  /**
   * Builds menu groups mirroring the toolbar edit controls.
   */
  const groups = useMemo((): MenuItem[][] => {
    /**
     * Returns whether a move direction is available for the targeted action.
     *
     * @param direction - Ahead or behind.
     * @returns True when the swap is allowed and playback is idle.
     */
    const canMove = (direction: WorkflowActionMoveDirection): boolean =>
      !playing && canMoveWorkflowAction(actionIndex, actionCount, direction);

    return [
      [
        {
          label: 'Move ahead',
          disabled: !canMove('ahead'),
          onSelect: onMoveAhead
        },
        {
          label: 'Move behind',
          disabled: !canMove('behind'),
          onSelect: onMoveBehind
        }
      ],
      [
        {
          label: 'Delete',
          variant: 'danger',
          disabled: playing || actionIndex < 0 || actionIndex >= actionCount,
          onSelect: onDelete
        }
      ]
    ];
  }, [actionCount, actionIndex, onDelete, onMoveAhead, onMoveBehind, playing]);

  return <TabContextMenu groups={groups} position={position} onClose={onClose} />;
}
