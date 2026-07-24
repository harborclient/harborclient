import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/SidebarRowActionsMenu';
import { buildGitItemMenuGroups } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/buildGitItemMenuGroups';
import type { CollectionDocument, GitRequestFileStatus } from '#/shared/types';
import type { MenuItem } from '@harborclient/sdk/components';
import { type JSX, useMemo } from 'react';

interface Props {
  /**
   * Markdown document this menu acts on.
   */
  doc: CollectionDocument;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Cursor position from the last context-menu open, used for developer inspect.
   */
  inspectPoint?: InspectPoint;

  /**
   * Opens the rename modal for this document.
   */
  onRenameDocument: (doc: CollectionDocument) => void;

  /**
   * Deletes the markdown document.
   */
  onDeleteDocument: (id: number, collectionId: number) => Promise<void>;

  /**
   * Per-item git status when the parent collection is git-backed.
   */
  gitItemStatus?: GitRequestFileStatus;

  /**
   * Stages this document for commit in a git-backed collection.
   */
  onGitStageItem?: () => void;

  /**
   * Unstages this document in a git-backed collection.
   */
  onGitUnstageItem?: () => void;
}

/**
 * Builds and renders the document row actions menu, including rename, optional
 * git stage/unstage, delete with confirm, color picker, and developer inspect.
 */
export function ActionsMenu({
  doc,
  openMenuId,
  onOpenChange,
  inspectPoint,
  onRenameDocument,
  onDeleteDocument,
  gitItemStatus,
  onGitStageItem,
  onGitUnstageItem
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `document-${doc.id}`;

  /**
   * Assembles rename, git, delete, and developer-inspect action groups.
   */
  const menuGroups = useMemo(() => {
    /**
     * Opens the rename modal for this document.
     */
    const handleRename = (): void => {
      onRenameDocument(doc);
    };

    /**
     * Confirms and deletes the document when the user chooses Delete.
     */
    const handleDelete = (): void => {
      void (async () => {
        const confirmed = await confirm({
          title: 'Delete document',
          message: `Delete document "${doc.name}"?`,
          confirmLabel: 'Delete',
          variant: 'danger'
        });
        if (confirmed) {
          void onDeleteDocument(doc.id, doc.collection_id);
        }
      })();
    };

    const renameGroup: MenuItem[] = [{ label: 'Rename', onSelect: handleRename }];

    const gitGroups = buildGitItemMenuGroups(
      onGitStageItem != null,
      gitItemStatus,
      () => onGitStageItem?.(),
      () => onGitUnstageItem?.()
    );

    const deleteGroup: MenuItem[] = [
      {
        label: 'Delete',
        variant: 'danger',
        onSelect: handleDelete
      }
    ];

    const inspectGroups = buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled);

    return [renameGroup].concat(gitGroups).concat([deleteGroup]).concat(inspectGroups);
  }, [
    confirm,
    developerToolsEnabled,
    doc,
    gitItemStatus,
    inspectPoint,
    menuId,
    onDeleteDocument,
    onGitStageItem,
    onGitUnstageItem,
    onRenameDocument
  ]);

  const colorTarget = {
    kind: 'document' as const,
    collectionId: doc.collection_id,
    id: doc.id,
    color: doc.color ?? null
  };

  return (
    <SidebarRowActionsMenu
      menuId={menuId}
      openMenuId={openMenuId}
      onOpenChange={onOpenChange}
      colorTarget={colorTarget}
      groups={menuGroups}
    />
  );
}
