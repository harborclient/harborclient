import { RowActionsMenu } from '@harborclient/sdk/components';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import type { SavedRequest } from '#/shared/types';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { usePluginContextMenuItems } from '#/renderer/src/plugins/pluginHooks';
import { buildPluginContextMenuGroups } from '#/renderer/src/plugins/pluginContextMenuHelpers';
import {
  buildSendRuntimeVars,
  resolveRequestUrl
} from '#/renderer/src/scripting/resolveRequestUrl';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments
} from '#/renderer/src/store/selectors';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { requestDragId } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/utils';
import { type JSX, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/shared/devInspectContextMenu';
import { SortableRow } from './SortableRow';

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
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

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
   * Loads the request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;

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
   * When true, renders the row without drag-and-drop reordering.
   */
  dragDisabled?: boolean;
}

/**
 * Renders a draggable saved-request row with method badge and row actions menu.
 */
export function RequestRow({
  req,
  activeRequestId,
  openMenuId,
  onOpenChange,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRunRequest,
  onLoadRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onExportRequest,
  dragDisabled = false
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | undefined>(undefined);
  const pluginContextMenuItems = usePluginContextMenuItems();
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  /**
   * Resolves the saved request URL with current globals, collection, and environment variables.
   */
  const resolvedUrl = useMemo(() => {
    const collection = collections.find((entry) => entry.id === req.collection_id);
    const environment = activeEnvironmentId
      ? environments.find((entry) => entry.id === activeEnvironmentId)
      : undefined;
    const runtimeVars = buildSendRuntimeVars(
      globalVariables,
      collection?.variables ?? [],
      environment?.variables ?? []
    );
    return resolveRequestUrl(req.url, req.params, runtimeVars);
  }, [
    activeEnvironmentId,
    collections,
    environments,
    globalVariables,
    req.collection_id,
    req.params,
    req.url
  ]);

  const reorderItems = [
    ...(canMoveUp ? [{ label: 'Move up', onSelect: onMoveUp }] : []),
    ...(canMoveDown ? [{ label: 'Move down', onSelect: onMoveDown }] : [])
  ];

  const copyItem =
    req.url.trim() !== ''
      ? [
          {
            label: 'Copy',
            onSelect: () => {
              void navigator.clipboard.writeText(resolvedUrl).then(() => {
                toast.success('Copied to clipboard');
              });
            }
          }
        ]
      : [];

  const menuId = `request-${req.id}`;

  return (
    <SortableRow
      id={requestDragId(req.id)}
      className={sourceRow(activeRequestId === req.id, true)}
      dragHandleLabel={`Reorder request "${req.name}"`}
      disabled={dragDisabled}
      compact
      onRowContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setInspectPoint({ x: event.clientX, y: event.clientY });
        onOpenChange(menuId);
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
        aria-current={activeRequestId === req.id ? 'true' : undefined}
        onClick={() => onLoadRequest(req)}
      >
        <span
          className={`shrink-0 px-1 py-px text-[16px] ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'text-info'}`}
        >
          {req.method}
        </span>
        <span className="truncate text-[16px]">{req.name}</span>
      </button>
      <RowActionsMenu
        menuId={menuId}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        groups={[
          [...copyItem, { label: 'Run', onSelect: onRunRequest }],
          ...(reorderItems.length > 0 ? [reorderItems] : []),
          [
            {
              label: 'Duplicate',
              onSelect: () => void onDuplicateRequest(req)
            },
            {
              label: 'Export',
              onSelect: () => void onExportRequest(req)
            }
          ],
          ...buildPluginContextMenuGroups(
            'request',
            {
              requestId: req.id,
              collectionId: req.collection_id,
              folderId: req.folder_id
            },
            pluginContextMenuItems
          ),
          [
            {
              label: 'Delete',
              variant: 'danger' as const,
              onSelect: () => {
                void (async () => {
                  const confirmed = await confirm({
                    title: 'Delete request',
                    message: `Delete request "${req.name}"?`,
                    confirmLabel: 'Delete',
                    variant: 'danger'
                  });
                  if (confirmed) {
                    void onDeleteRequest(req.id);
                  }
                })();
              }
            }
          ],
          ...buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled)
        ]}
      />
    </SortableRow>
  );
}
