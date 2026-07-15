import type { JSX } from 'react';
import type { ThemePreviewPalette } from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';
import { PreviewContentRows } from '#/renderer/src/ui/Modals/ThemePickerModal/ThemePreviewCard/PreviewContentRows';

interface Props {
  /**
   * Colors for surfaces, text, and accent controls.
   */
  palette: ThemePreviewPalette;
}

/**
 * Renders a simplified mini-app mock using the given preview palette.
 */
export function ThemePreviewMock({ palette }: Props): JSX.Element {
  return (
    <div
      className="flex h-24 overflow-hidden rounded-md border"
      style={{ borderColor: palette.border, backgroundColor: palette.surface }}
      aria-hidden
    >
      <div className="w-1/4 shrink-0 p-1.5" style={{ backgroundColor: palette.sidebar }}>
        <div
          className="mb-1.5 h-1.5 w-full rounded-sm"
          style={{ backgroundColor: palette.muted }}
        />
        <div className="mb-1 h-1 w-3/4 rounded-sm" style={{ backgroundColor: palette.muted }} />
        <div className="h-1 w-2/3 rounded-sm" style={{ backgroundColor: palette.muted }} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-1.5">
        <PreviewContentRows palette={palette} />
      </div>
    </div>
  );
}
