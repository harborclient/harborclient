import type { JSX } from 'react';
import {
  DARK_PREVIEW_PALETTE,
  LIGHT_PREVIEW_PALETTE
} from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';
import { PreviewContentRows } from '#/renderer/src/ui/Modals/ThemePickerModal/ThemePreviewCard/PreviewContentRows';

/**
 * Renders a split light/dark mock for the system theme card.
 */
export function SystemThemePreviewMock(): JSX.Element {
  return (
    <div
      className="flex h-24 overflow-hidden rounded-md border"
      style={{ borderColor: LIGHT_PREVIEW_PALETTE.border }}
      aria-hidden
    >
      <div
        className="flex w-1/2 overflow-hidden"
        style={{ backgroundColor: LIGHT_PREVIEW_PALETTE.surface }}
      >
        <div
          className="w-1/3 shrink-0 p-1"
          style={{ backgroundColor: LIGHT_PREVIEW_PALETTE.sidebar }}
        />
        <div className="flex min-w-0 flex-1 flex-col p-1">
          <PreviewContentRows palette={LIGHT_PREVIEW_PALETTE} />
        </div>
      </div>
      <div
        className="flex w-1/2 overflow-hidden border-l"
        style={{
          backgroundColor: DARK_PREVIEW_PALETTE.surface,
          borderColor: DARK_PREVIEW_PALETTE.border
        }}
      >
        <div
          className="w-1/3 shrink-0 p-1"
          style={{ backgroundColor: DARK_PREVIEW_PALETTE.sidebar }}
        />
        <div className="flex min-w-0 flex-1 flex-col p-1">
          <PreviewContentRows palette={DARK_PREVIEW_PALETTE} />
        </div>
      </div>
    </div>
  );
}
