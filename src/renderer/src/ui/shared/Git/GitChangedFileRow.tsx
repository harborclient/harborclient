import {
  SidebarDocumentItem,
  SidebarItem,
  SidebarRequestItem,
  SidebarStatusMarker,
  SIDEBAR_ITEM_BUTTON_CLASS
} from '@harborclient/sdk/components';
import { useMemo, type JSX, type MouseEvent, type ReactNode } from 'react';
import { faMarkdown } from '#/renderer/src/fontawesome';
import {
  buildGitChangedFileRowPresentation,
  type GitChangedFileRowFile
} from '#/renderer/src/ui/shared/Git/gitChangedFileRow.logic';

interface Props {
  /**
   * Changed file entry with path, status, and optional resource metadata.
   */
  file: GitChangedFileRowFile;

  /**
   * Opens the diff modal, conflict editor, or other row action.
   */
  onClick: () => void;

  /**
   * Whether the file has unresolved merge conflict markers.
   */
  hasConflict?: boolean;

  /**
   * Optional trailing row actions, such as a revert menu.
   */
  actions?: ReactNode;

  /**
   * Opens a context menu when the user right-clicks the row.
   */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Renders one git changed-file row in a sidebar-style list.
 */
export function GitChangedFileRow({
  file,
  onClick,
  hasConflict = false,
  actions,
  onContextMenu
}: Props): JSX.Element {
  /**
   * Resolves display label, status marker styling, and accessible name for the row.
   */
  const { displayLabel, statusMarkerProps, rowAriaLabel } = useMemo(
    () => buildGitChangedFileRowPresentation(file, hasConflict),
    [file, hasConflict]
  );

  if (file.resourceKind === 'request' && file.method != null) {
    return (
      <SidebarRequestItem
        as="li"
        method={file.method}
        name={displayLabel}
        statusMarker={statusMarkerProps}
        ariaLabel={rowAriaLabel}
        onClick={onClick}
        onContextMenu={onContextMenu}
        actions={actions}
      />
    );
  }

  if (file.resourceKind === 'document') {
    return (
      <SidebarDocumentItem
        as="li"
        icon={faMarkdown}
        name={displayLabel}
        statusMarker={statusMarkerProps}
        ariaLabel={rowAriaLabel}
        onClick={onClick}
        onContextMenu={onContextMenu}
        actions={actions}
      />
    );
  }

  return (
    <SidebarItem as="li" onContextMenu={onContextMenu} actions={actions}>
      <button
        type="button"
        className={SIDEBAR_ITEM_BUTTON_CLASS}
        aria-label={rowAriaLabel}
        onClick={onClick}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <SidebarStatusMarker
          marker={statusMarkerProps.marker}
          className={statusMarkerProps.className}
          label={statusMarkerProps.label}
        />
      </button>
    </SidebarItem>
  );
}
