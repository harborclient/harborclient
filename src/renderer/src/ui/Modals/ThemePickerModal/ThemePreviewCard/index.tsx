import { useCallback, useId, type JSX, type KeyboardEvent } from 'react';
import {
  getThemePreviewPalette,
  type BuiltinThemeSource
} from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';
import { SystemThemePreviewMock } from '#/renderer/src/ui/Modals/ThemePickerModal/ThemePreviewCard/SystemThemePreviewMock';
import { ThemePreviewMock } from '#/renderer/src/ui/Modals/ThemePickerModal/ThemePreviewCard/ThemePreviewMock';

interface Props {
  /**
   * Built-in theme id represented by this card.
   */
  theme: BuiltinThemeSource;

  /**
   * Human-readable theme label shown below the preview mock.
   */
  label: string;

  /**
   * Whether this card is the currently selected option.
   */
  selected: boolean;

  /**
   * Radio group name shared by all theme cards.
   */
  radioGroupName: string;

  /**
   * Called when the user selects this theme card.
   */
  onSelect: (theme: BuiltinThemeSource) => void;

  /**
   * Roving tabindex for keyboard navigation within the parent radiogroup.
   */
  tabIndex?: number;

  /**
   * When true, focuses this card when the modal opens.
   */
  autoFocus?: boolean;

  /**
   * Registers the card button for programmatic focus from the parent radiogroup.
   */
  registerButtonRef?: (element: HTMLButtonElement | null) => void;
}

/**
 * Selectable card showing a simplified preview of one built-in appearance theme.
 */
export function ThemePreviewCard({
  theme,
  label,
  selected,
  radioGroupName,
  onSelect,
  tabIndex = 0,
  autoFocus = false,
  registerButtonRef
}: Props): JSX.Element {
  const palette = getThemePreviewPalette(theme);
  const labelId = useId();

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
      ref={registerButtonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={labelId}
      name={radioGroupName}
      tabIndex={tabIndex}
      autoFocus={autoFocus}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={[
        'flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-separator hover:border-accent/50'
      ].join(' ')}
    >
      {theme === 'system' ? <SystemThemePreviewMock /> : <ThemePreviewMock palette={palette} />}
      <span id={labelId} className="text-[14px] font-medium text-text">
        {label}
      </span>
    </button>
  );
}
