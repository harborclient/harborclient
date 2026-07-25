import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useId, useRef, useState } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, KeyboardEvent } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';
import { DEFAULT_COLOR_PICKER_PRESETS, colorsMatch, toHexColorInputValue } from './colorUtils.js';
import {
  DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY,
  loadCustomSwatches,
  padCustomSwatchSlots,
  persistCustomSwatches
} from './customSwatches.js';

export interface Props extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'className' | 'onChange'
> {
  /**
   * Currently selected color, or null when no color is assigned.
   */
  value: string | null;

  /**
   * Called when the user picks a preset or custom swatch color.
   */
  onChange: (color: string) => void;

  /**
   * Called when the user clears the current color. Omitted when clearing is disabled.
   */
  onClear?: () => void;

  /**
   * Fixed preset swatches (defaults to two rows of five HarborClient colors).
   */
  presets?: readonly string[];

  /**
   * localStorage key for persisting custom swatch slot colors.
   */
  customSwatchesStorageKey?: string;

  /**
   * Accessible name for the swatch grid.
   */
  'aria-label'?: string;

  /**
   * Additional classes on the outer wrapper.
   */
  className?: string;
}

/**
 * Swatch-grid color picker with preset rows and user-defined custom slots.
 *
 * Custom slots open the native OS color picker via a hidden `<input type="color">`.
 * Chosen custom colors are saved to localStorage for reuse.
 */
export function ColorPicker({
  value,
  onChange,
  onClear,
  presets = DEFAULT_COLOR_PICKER_PRESETS,
  customSwatchesStorageKey = DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY,
  'aria-label': ariaLabel = 'Choose a color',
  className,
  ...props
}: Props): JSX.Element {
  const groupId = useId();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const pendingCustomSlotRef = useRef<number | null>(null);
  const [customSlots, setCustomSlots] = useState<string[]>(() =>
    padCustomSwatchSlots(loadCustomSwatches(customSwatchesStorageKey))
  );

  /**
   * Reloads custom swatches when the storage key changes (e.g. isolated tests).
   */
  useEffect(() => {
    setCustomSlots(padCustomSwatchSlots(loadCustomSwatches(customSwatchesStorageKey)));
  }, [customSwatchesStorageKey]);

  /**
   * Persists custom slot colors whenever they change.
   */
  useEffect(() => {
    persistCustomSwatches(customSwatchesStorageKey, customSlots);
  }, [customSlots, customSwatchesStorageKey]);

  /**
   * Applies a color chosen from the native picker to the pending custom slot.
   *
   * @param hex - Hex color from the native input.
   */
  const applyNativePickerColor = useCallback(
    (hex: string): void => {
      const slotIndex = pendingCustomSlotRef.current;
      if (slotIndex == null) {
        return;
      }

      setCustomSlots((current) => {
        const next = [...current];
        next[slotIndex] = hex;
        return next;
      });
      onChange(hex);
      pendingCustomSlotRef.current = null;
    },
    [onChange]
  );

  /**
   * Opens the native color picker for an empty or filled custom slot.
   *
   * @param slotIndex - Zero-based custom slot index.
   * @param currentSlotColor - Existing color in the slot, if any.
   */
  const openNativePickerForSlot = useCallback(
    (slotIndex: number, currentSlotColor: string): void => {
      pendingCustomSlotRef.current = slotIndex;
      const input = nativeInputRef.current;
      if (!input) {
        return;
      }
      input.value = toHexColorInputValue(currentSlotColor || null);
      input.click();
    },
    []
  );

  /**
   * Renders one circular swatch button with optional selection checkmark.
   *
   * @param color - CSS background color for the swatch.
   * @param label - Accessible name for the swatch.
   * @param selected - Whether this swatch matches the current value.
   * @param onSelect - Called when the swatch is activated.
   * @param onEdit - When set, double-click or a modifier opens the native picker.
   */
  const renderSwatch = (
    color: string,
    label: string,
    selected: boolean,
    onSelect: () => void,
    onEdit?: () => void
  ): JSX.Element => {
    /**
     * Activates the swatch on Enter or Space.
     *
     * @param event - Keyboard event on the swatch button.
     */
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    };

    return (
      <button
        key={`${label}-${color}`}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-separator',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
        style={{ backgroundColor: color }}
        onClick={onSelect}
        onDoubleClick={
          onEdit
            ? (event) => {
                event.preventDefault();
                onEdit();
              }
            : undefined
        }
        onKeyDown={handleKeyDown}
      >
        {selected ? (
          <FaIcon icon={faCheck} className="h-3.5 w-3.5 text-white drop-shadow-sm" aria-hidden />
        ) : null}
      </button>
    );
  };

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      role="radiogroup"
      aria-label={ariaLabel}
      id={groupId}
      {...props}
    >
      <div className="grid grid-cols-5 gap-2">
        {presets.map((color, index) =>
          renderSwatch(color, `Preset color ${index + 1}`, colorsMatch(value, color), () =>
            onChange(color)
          )
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {customSlots.map((slotColor, index) => {
          const hasColor = slotColor.trim() !== '';
          const displayColor = hasColor ? slotColor : '#d4d4d4';

          return renderSwatch(
            displayColor,
            hasColor ? `Custom color ${index + 1}` : `Define custom color ${index + 1}`,
            hasColor && colorsMatch(value, slotColor),
            () => {
              if (hasColor) {
                onChange(slotColor);
                return;
              }
              openNativePickerForSlot(index, slotColor);
            },
            () => openNativePickerForSlot(index, slotColor)
          );
        })}
      </div>
      {onClear != null && value != null && value.trim() !== '' ? (
        <button
          type="button"
          className="self-start text-[14px] text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onClear}
        >
          Clear color
        </button>
      ) : null}
      <input
        ref={nativeInputRef}
        type="color"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => applyNativePickerColor(event.target.value)}
      />
    </div>
  );
}
