import type { CSSProperties, JSX } from 'react';
import type { ThemePreviewPalette } from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';

interface Props {
  /**
   * Colors for surfaces, text, and accent controls.
   */
  palette: ThemePreviewPalette;
}

/**
 * Renders content rows inside a preview mock panel.
 */
export function PreviewContentRows({ palette }: Props): JSX.Element {
  /**
   * Builds inline styles for a muted content row bar at the given width.
   *
   * @param width - CSS width for the bar (percentage or length).
   * @returns Style object for a single preview content row.
   */
  const rowStyle = (width: string): CSSProperties => ({
    height: 4,
    width,
    borderRadius: 2,
    backgroundColor: palette.muted,
    opacity: 0.65
  });

  return (
    <>
      <div
        className="mb-1.5 h-3 w-full rounded-sm"
        style={{ backgroundColor: palette.control, border: `1px solid ${palette.border}` }}
      />
      <div className="mb-1" style={rowStyle('85%')} />
      <div className="mb-1" style={rowStyle('70%')} />
      <div className="mb-auto" style={rowStyle('55%')} />
      <div
        className="mt-1 h-3 w-10 self-end rounded-sm"
        style={{ backgroundColor: palette.accent }}
      />
    </>
  );
}
