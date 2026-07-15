import { FormGroup, Input } from '@harborclient/sdk/components';
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import { RgbaColorPicker } from 'react-colorful';
import type { ThemeColorToken } from '@harborclient/sdk';
import { CUSTOM_THEME_TOKEN_LABELS } from '#/shared/types/customTheme';
import {
  FALLBACK_RGBA_COLOR,
  formatCssColor,
  parseCssColor
} from '#/renderer/src/ui/Tabs/Plugins/colorUtils';

interface Props {
  /**
   * Theme color token being edited.
   */
  token: ThemeColorToken;

  /**
   * Current CSS color value for the token.
   */
  value: string;

  /**
   * Updates the token value in the Designer draft.
   */
  onChange: (token: ThemeColorToken, value: string) => void;
}

/**
 * One labeled color picker field with a popover RGBA picker and text input.
 */
export function ColorTokenField({ token, value, onChange }: Props): JSX.Element {
  const fieldId = useId();
  const popoverId = `${fieldId}-popover`;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsedColor = parseCssColor(value) ?? FALLBACK_RGBA_COLOR;

  /**
   * Closes the popover when the user clicks outside the field container.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    /**
     * Closes the color picker when focus moves outside the field.
     *
     * @param event - Document mouse event.
     */
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <FormGroup label={CUSTOM_THEME_TOKEN_LABELS[token]} htmlFor={fieldId} className="min-w-0">
      <div ref={containerRef} className="relative min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            id={fieldId}
            className="h-9 w-9 shrink-0 rounded-md border border-separator focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ backgroundColor: value }}
            aria-label={`Choose ${CUSTOM_THEME_TOKEN_LABELS[token]} color`}
            aria-expanded={open}
            aria-controls={popoverId}
            onClick={() => setOpen((current) => !current)}
          />
          <Input
            value={value}
            className="min-w-0 flex-1"
            aria-describedby={popoverId}
            onChange={(event) => onChange(token, event.target.value)}
          />
        </div>
        {open ? (
          <div
            id={popoverId}
            className="absolute left-0 top-full z-20 mt-2 rounded-md border border-separator bg-panel p-3 shadow-lg"
            role="dialog"
            aria-label={`${CUSTOM_THEME_TOKEN_LABELS[token]} color picker`}
          >
            <RgbaColorPicker
              color={parsedColor}
              onChange={(color) => onChange(token, formatCssColor(color))}
            />
          </div>
        ) : null}
      </div>
    </FormGroup>
  );
}
