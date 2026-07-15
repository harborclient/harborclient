import { SidebarDocumentItem } from '@harborclient/sdk/components';
import { faMarkdown } from '#/renderer/src/fontawesome';
import { type InspectPoint } from '#/renderer/src/ui/Shared/devInspectContextMenu';
import {
  buildGitItemAccessibleName,
  gitItemNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import type { CollectionDocument, GitRequestFileStatus } from '#/shared/types';
import { type JSX, useState } from 'react';
import { ActionsMenu } from './ActionsMenu';

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
  const { showColorDots } = useSidebarExpansion();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | undefined>(undefined);

  const menuId = `document-${doc.id}`;

  return (
    <div data-sidebar-document-id={doc.id} className="contents">
      <SidebarDocumentItem
        icon={faMarkdown}
        name={doc.name}
        nameClassName={gitItemNameClass(gitItemStatus)}
        colorDot={{
          color: doc.color,
          visible: showColorDots,
          label: `Color for ${doc.name}`
        }}
        selected={activeDocumentId === doc.id}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setInspectPoint({ x: event.clientX, y: event.clientY });
          onOpenChange(menuId);
        }}
        onClick={() => onLoadDocument(doc)}
        onDoubleClick={() => onRenameDocument(doc)}
        ariaLabel={buildGitItemAccessibleName(doc.name, gitItemStatus)}
        ariaCurrent={activeDocumentId === doc.id}
        actions={
          <ActionsMenu
            doc={doc}
            openMenuId={openMenuId}
            onOpenChange={onOpenChange}
            inspectPoint={inspectPoint}
            onRenameDocument={onRenameDocument}
            onDeleteDocument={onDeleteDocument}
            gitItemStatus={gitItemStatus}
            onGitStageItem={onGitStageItem}
            onGitUnstageItem={onGitUnstageItem}
          />
        }
      />
    </div>
  );
}
