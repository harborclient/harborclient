import { AnchorMenuPanel, type MenuItem } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX, type MouseEvent } from 'react';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled,
  type InspectPoint
} from '#/renderer/src/ui/Shared/devInspectContextMenu';

const IMAGE_VIEW_CONTEXT_MENU_ID = 'image-view-context-menu';

interface Props {
  /**
   * Whether the image is still loading from disk.
   */
  loading: boolean;

  /**
   * Load error message for path-based images, when present.
   */
  error: string | null;

  /**
   * Resolved image URL for the preview, when available.
   */
  resolvedSrc: string | null;

  /**
   * Accessible filename used for the image alt text.
   */
  fileName: string;

  /**
   * Whether a save dialog is already in progress.
   */
  saving: boolean;

  /**
   * Opens the native save dialog for the current image.
   */
  onSave: () => void;
}

/**
 * Scrollable image viewer body with a right-click Save action on the preview area.
 */
export function ImageViewContent({
  loading,
  error,
  resolvedSrc,
  fileName,
  saving,
  onSave
}: Props): JSX.Element {
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const [inspectPoint, setInspectPoint] = useState<InspectPoint | null>(null);

  /**
   * Context menu entries shown when the user right-clicks the viewer body.
   */
  const menuGroups = useMemo((): MenuItem[][] => {
    const groups: MenuItem[][] = [
      [
        {
          label: 'Save',
          disabled: saving,
          onSelect: onSave
        }
      ]
    ];

    const inspectGroups = buildDevInspectMenuGroups(
      inspectPoint ?? undefined,
      IMAGE_VIEW_CONTEXT_MENU_ID,
      developerToolsEnabled
    );
    for (const group of inspectGroups) {
      groups.push(group);
    }

    return groups;
  }, [developerToolsEnabled, inspectPoint, onSave, saving]);

  /**
   * Opens the viewer context menu at the cursor and suppresses the native menu.
   */
  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>): void => {
    event.preventDefault();
    setInspectPoint({ x: event.clientX, y: event.clientY });
  }, []);

  /**
   * Closes the open viewer context menu.
   */
  const dismissContextMenu = useCallback((): void => {
    setInspectPoint(null);
  }, []);

  return (
    <>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto"
        onContextMenu={handleContextMenu}
      >
        {loading ? (
          <p className="m-0 text-muted" role="status">
            Loading image…
          </p>
        ) : error != null ? (
          <p className="m-0 text-danger" role="alert">
            {error}
          </p>
        ) : resolvedSrc != null ? (
          <img src={resolvedSrc} alt={fileName} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="m-0 text-muted" role="status">
            Image preview is unavailable.
          </p>
        )}
      </div>
      {inspectPoint != null ? (
        <AnchorMenuPanel
          menuId={IMAGE_VIEW_CONTEXT_MENU_ID}
          groups={menuGroups}
          anchor={inspectPoint}
          onDismiss={dismissContextMenu}
        />
      ) : null}
    </>
  );
}
