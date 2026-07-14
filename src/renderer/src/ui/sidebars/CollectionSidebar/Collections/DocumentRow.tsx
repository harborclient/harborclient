import { FaIcon } from '@harborclient/sdk/components';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faMarkdown } from '#/renderer/src/fontawesome';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/shared/devInspectContextMenu';
import { SidebarColorDot } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarColorDot';
import { SidebarRowActionsMenu } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarRowActionsMenu';
import { buildGitItemMenuGroups } from '#/renderer/src/ui/sidebars/CollectionSidebar/buildGitItemMenuGroups';
import {
  buildGitItemAccessibleName,
  gitItemNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import type { CollectionDocument, GitRequestFileStatus } from '#/shared/types';
import { type JSX, useMemo, useState } from 'react';

interface Props {
  /**
   * Markdown document rendered in this row.
   */
  doc: CollectionDocument;

  /**
   * Currently active document id, used for row selection styling.
   */
  activeDocumentId?: number;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenChange: (menuId: string | null) => void;

  /**
   * Opens the document in the editor.
   */
  onLoadDocument: (doc: CollectionDocument) => void;

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
 * Renders a static collection markdown document row with file icon and row actions menu.
 * Documents are pinned to the top of each container and sorted alphabetically by name.
 */
export function DocumentRow({
  doc,
  activeDocumentId,
  openMenuId,
  onOpenChange,
  onLoadDocument,
  onRenameDocument,
  onDeleteDocument,
  gitItemStatus,
  onGitStageItem,
  onGitUnstageItem
}: Props): JSX.Element {
  const confirm = useConfirm();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | undefined>(undefined);

  const menuId = `document-${doc.id}`;

  /**
   * Builds document row actions including optional git stage/unstage entries.
   */
  const menuGroups = useMemo(
    () => [
      [
        {
          label: 'Rename',
          onSelect: () => onRenameDocument(doc)
        }
      ],
      ...buildGitItemMenuGroups(
        onGitStageItem != null,
        gitItemStatus,
        () => onGitStageItem?.(),
        () => onGitUnstageItem?.()
      ),
      [
        {
          label: 'Delete',
          variant: 'danger' as const,
          onSelect: () => {
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
          }
        }
      ],
      ...buildDevInspectMenuGroups(inspectPoint, menuId, developerToolsEnabled)
    ],
    [
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
    ]
  );

  return (
    <div
      className={`group ${sourceRow(activeDocumentId === doc.id, true)}`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setInspectPoint({ x: event.clientX, y: event.clientY });
        onOpenChange(menuId);
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
        aria-current={activeDocumentId === doc.id ? 'true' : undefined}
        aria-label={buildGitItemAccessibleName(doc.name, gitItemStatus)}
        onClick={() => onLoadDocument(doc)}
        onDoubleClick={() => onRenameDocument(doc)}
      >
        <FaIcon icon={faMarkdown} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className={`truncate ${gitItemNameClass(gitItemStatus)}`}>{doc.name}</span>
          <SidebarColorDot color={doc.color} label={`Color for ${doc.name}`} />
        </span>
      </button>
      <SidebarRowActionsMenu
        menuId={menuId}
        openMenuId={openMenuId}
        onOpenChange={onOpenChange}
        colorTarget={{
          kind: 'document',
          collectionId: doc.collection_id,
          id: doc.id,
          color: doc.color ?? null
        }}
        groups={menuGroups}
      />
    </div>
  );
}
