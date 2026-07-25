import { FormGroup, Input, Select } from '@harborclient/sdk/components';
import { useId, useMemo, type JSX } from 'react';
import type { ThemeMetricToken } from '@harborclient/sdk';
import {
  CUSTOM_THEME_METRIC_LABELS,
  customThemeMetricControlKind
} from '@harborclient/core/types/customTheme';
import { DEFAULT_THEME_FONT_SANS, THEME_FONT_FAMILY_SUGGESTIONS } from './customThemeDefaults';

interface Props {
  /**
   * Theme metric token being edited.
   */
  token: ThemeMetricToken;

  /**
   * Current CSS value for the token.
   */
  value: string;

  /**
   * Updates the token value in the Designer draft.
   */
  onChange: (token: ThemeMetricToken, value: string) => void;
}

/**
 * Parses a CSS length into a numeric amount and unit for the metric editor.
 *
 * @param value - CSS length such as `14px` or `0.375rem`.
 * @returns Parsed amount/unit, or null when the value is not a simple length.
 */
function parseCssLength(value: string): { amount: string; unit: 'px' | 'rem' } | null {
  const match = /^(-?\d+(?:\.\d+)?)(px|rem)$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  return {
    amount: match[1],
    unit: match[2].toLowerCase() as 'px' | 'rem'
  };
}

/**
 * Renders one labeled metric field with font suggestions or length controls.
 */
export function MetricTokenField({ token, value, onChange }: Props): JSX.Element {
  const fieldId = useId();
  const unitId = `${fieldId}-unit`;
  const fontFamilyListId = `${fieldId}-font-family-list`;
  const kind = customThemeMetricControlKind(token);
  const label = CUSTOM_THEME_METRIC_LABELS[token];
  const parsedLength = useMemo(() => parseCssLength(value), [value]);
  const showLengthControls = kind !== 'font-family' && parsedLength != null;

  /**
   * Updates the numeric amount while preserving the current unit.
   *
   * @param amount - Raw amount text from the number input.
   */
  const handleAmountChange = (amount: string): void => {
    const unit = parsedLength?.unit ?? 'px';
    if (amount.trim().length === 0) {
      onChange(token, amount);
      return;
    }
    onChange(token, `${amount}${unit}`);
  };

  /**
   * Updates the unit while preserving the current amount.
   *
   * @param unit - Selected CSS length unit.
   */
  const handleUnitChange = (unit: string): void => {
    const amount = parsedLength?.amount ?? '0';
    onChange(token, `${amount}${unit}`);
  };

  return (
    <FormGroup label={label} htmlFor={fieldId} className="min-w-0">
      {showLengthControls ? (
        <div className="flex min-w-0 items-center gap-2">
          <Input
            id={fieldId}
            type="text"
            inputMode="decimal"
            value={parsedLength.amount}
            className="min-w-0 flex-1"
            aria-label={`${label} amount`}
            onChange={(event) => handleAmountChange(event.target.value)}
          />
          <Select
            id={unitId}
            value={parsedLength.unit}
            className="w-24 shrink-0"
            aria-label={`${label} unit`}
            onChange={(event) => handleUnitChange(event.target.value)}
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
          </Select>
        </div>
      ) : (
        <>
          <Input
            id={fieldId}
            value={value}
            className="min-w-0"
            list={kind === 'font-family' ? fontFamilyListId : undefined}
            placeholder={kind === 'font-family' ? DEFAULT_THEME_FONT_SANS : undefined}
            onChange={(event) => onChange(token, event.target.value)}
          />
          {kind === 'font-family' ? (
            <datalist id={fontFamilyListId}>
              {THEME_FONT_FAMILY_SUGGESTIONS.map((fontFamily) => (
                <option key={fontFamily} value={fontFamily} />
              ))}
            </datalist>
          ) : null}
        </>
      )}
    </FormGroup>
  );
}
