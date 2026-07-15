import { SidebarRequestItem } from '@harborclient/sdk/components';
import type { GitRequestFileStatus, SavedRequest } from '#/shared/types';

import { requestDragId } from '../utils';
import { type JSX, type MouseEvent, useState } from 'react';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import {
  buildGitItemAccessibleName,
  gitItemNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { ActionsMenu } from './ActionsMenu';

interface Props {
  /**
   * Saved request rendered in this row.
   */
  req: SavedRequest;

  /**
   * Currently active request id, used for row selection styling.
   */
  activeRequestId?: number;

  /**
   * Whether this row is part of the current multi-selection.
   */
  selected: boolean;

  /**
   * Number of selected request rows in the sidebar.
   */
  selectionCount: number;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Handles primary and modifier clicks on the request row label.
   */
  onRowClick: (req: SavedRequest, event: MouseEvent<HTMLElement>) => void;

  /**
   * Updates selection before opening the context menu when needed.
   */
  onBeforeContextMenu: (req: SavedRequest) => void;

  /**
   * Whether the request can move one position up within its list.
   */
  canMoveUp: boolean;

  /**
   * Whether the request can move one position down within its list.
   */
  canMoveDown: boolean;

  /**
   * Moves the request one position up within its current folder or root list.
   */
  onMoveUp: () => void;

  /**
   * Moves the request one position down within its current folder or root list.
   */
  onMoveDown: () => void;

  /**
   * Opens the collection runner scoped to this request.
   */
  onRunRequest: () => void;

  /**
   * Deletes the saved request.
   */
  onDeleteRequest: (id: number) => Promise<void>;

  /**
   * Duplicates the saved request.
   */
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;

  /**
   * Exports the saved request to a JSON file.
   */
  onExportRequest: (req: SavedRequest) => Promise<void> | void;

  /**
   * Whether AI chat is available for "Copy to chat".
   */
  aiChatAvailable: boolean;

  /**
   * Copies the saved request reference into the AI chat composer.
   */
  onCopyToChat: (req: SavedRequest) => void;

  /**
   * Runs every request in the current multi-selection.
   */
  onRunSelected: () => void;

  /**
   * Opens every request in the current multi-selection.
   */
  onOpenSelected: () => void;

  /**
   * Creates a tab group from the current multi-selection.
   */
  onNewTabGroupFromSelected: () => void;

  /**
   * Deletes every request in the current multi-selection.
   */
  onDeleteSelected: () => void;

  /**
   * When true, renders the row without drag-and-drop reordering.
   */
  dragDisabled?: boolean;

  /**
   * Per-item git status when the parent collection is git-backed.
   */
  gitItemStatus?: GitRequestFileStatus;

  /**
   * Stages this request for commit in a git-backed collection.
   */
  onGitStageItem?: () => void;

  /**
   * Unstages this request in a git-backed collection.
   */
  onGitUnstageItem?: () => void;
}

/**
 * Renders a draggable saved-request row with method badge and row actions menu.
 */
export function RequestRow({
  req,
  activeRequestId,
  selected,
  selectionCount,
  openMenuId,
  onOpenChange,
  onRowClick,
  onBeforeContextMenu,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRunRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  aiChatAvailable,
  onCopyToChat,
  onRunSelected,
  onOpenSelected,
  onNewTabGroupFromSelected,
  onDeleteSelected,
  dragDisabled = false,
  gitItemStatus,
  onGitStageItem,
  onGitUnstageItem
}: Props): JSX.Element {
  const { showColorDots } = useSidebarExpansion();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | undefined>(undefined);

  const menuId = `request-${req.id}`;
  const rowHighlighted = activeRequestId === req.id || selected;

  return (
    <div data-sidebar-request-id={req.id} className="contents">
      <SidebarRequestItem
        method={req.method}
        name={req.name}
        nameClassName={gitItemNameClass(gitItemStatus)}
        colorDot={{
          color: req.color,
          visible: showColorDots,
          label: `Color for ${req.name}`
        }}
        selected={rowHighlighted}
        sortable={{
          id: requestDragId(req.id),
          dragHandleLabel: `Reorder request "${req.name}"`,
          disabled: dragDisabled
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onBeforeContextMenu(req);
          setInspectPoint({ x: event.clientX, y: event.clientY });
          onOpenChange(menuId);
        }}
        onClick={(event) => onRowClick(req, event)}
        ariaLabel={buildGitItemAccessibleName(req.name, gitItemStatus)}
        ariaCurrent={activeRequestId === req.id}
        ariaSelected={selected}
        actions={
          <ActionsMenu
            req={req}
            selected={selected}
            selectionCount={selectionCount}
            openMenuId={openMenuId}
            onOpenChange={onOpenChange}
            inspectPoint={inspectPoint}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRunRequest={onRunRequest}
            onDeleteRequest={onDeleteRequest}
            onDuplicateRequest={onDuplicateRequest}
            onExportRequest={onExportRequest}
            aiChatAvailable={aiChatAvailable}
            onCopyToChat={onCopyToChat}
            onRunSelected={onRunSelected}
            onOpenSelected={onOpenSelected}
            onNewTabGroupFromSelected={onNewTabGroupFromSelected}
            onDeleteSelected={onDeleteSelected}
            gitItemStatus={gitItemStatus}
            onGitStageItem={onGitStageItem}
            onGitUnstageItem={onGitUnstageItem}
          />
        }
      />
    </div>
  );
}
