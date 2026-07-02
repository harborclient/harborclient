import { useCallback, type CSSProperties, type JSX, type KeyboardEvent } from 'react';
import {
  DARK_PREVIEW_PALETTE,
  LIGHT_PREVIEW_PALETTE,
  type BuiltinThemeSource,
  type ThemePreviewPalette,
  getThemePreviewPalette
} from '#/renderer/src/ui/modals/ThemePickerModal/previewPalettes';

interface Props {
  /** Built-in theme id represented by this card. */
  theme: BuiltinThemeSource;
  /** Human-readable theme label shown below the preview mock. */
  label: string;
  /** Whether this card is the currently selected option. */
  selected: boolean;
  /** Radio group name shared by all theme cards. */
  radioGroupName: string;
  /** Called when the user selects this theme card. */
  onSelect: (theme: BuiltinThemeSource) => void;
}

/**
 * Renders content rows inside a preview mock panel.
 *
 * @param palette - Colors for surfaces, text, and accent controls.
 */
function PreviewContentRows({ palette }: { palette: ThemePreviewPalette }): JSX.Element {
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

/**
 * Renders a simplified mini-app mock using the given preview palette.
 *
 * @param palette - Colors for surfaces, text, and accent controls.
 */
function ThemePreviewMock({ palette }: { palette: ThemePreviewPalette }): JSX.Element {
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

/**
 * Renders a split light/dark mock for the system theme card.
 */
function SystemThemePreviewMock(): JSX.Element {
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

/**
 * Selectable card showing a simplified preview of one built-in appearance theme.
 */
export function ThemePreviewCard({
  theme,
  label,
  selected,
  radioGroupName,
  onSelect
}: Props): JSX.Element {
  const palette = getThemePreviewPalette(theme);

  /**
   * Selects this theme when the card receives a click or keyboard activation.
   */
  const handleSelect = useCallback((): void => {
    onSelect(theme);
  }, [onSelect, theme]);

  /**
   * Activates the card when Enter or Space is pressed.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelect();
      }
    },
    [handleSelect]
  );

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${label} theme`}
      name={radioGroupName}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={[
        'flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-separator hover:border-accent/50'
      ].join(' ')}
    >
      {theme === 'system' ? <SystemThemePreviewMock /> : <ThemePreviewMock palette={palette} />}
      <span className="text-[14px] font-medium text-text">{label}</span>
    </button>
  );
}
