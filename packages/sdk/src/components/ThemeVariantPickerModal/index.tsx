import { useCallback, useId, useState } from '@harborclient/sdk/react';
import type { JSX, ReactNode } from 'react';
import { Button } from '../Button/index.js';
import { FormGroup } from '../FormGroup/index.js';
import { Modal, ModalFooter } from '../Modal/index.js';
import { StatusMessage } from '../StatusMessage/index.js';
import { Radio, Select } from '../forms/index.js';

/**
 * One selectable theme variant shown in the picker.
 */
export interface ThemeVariantOption {
  /** Theme id within the plugin manifest. */
  id: string;

  /** Human-readable option label. */
  label: string;
}

export interface Props {
  /**
   * Selectable theme variants contributed by the plugin.
   */
  variants: ThemeVariantOption[];

  /**
   * Whether variants are chosen from a dropdown or a radio fieldset.
   */
  selectionMode: 'select' | 'radio';

  /**
   * Dialog heading rendered in the modal header row.
   */
  title: ReactNode;

  /**
   * Body copy shown above the selector (or alone when the selector is hidden).
   */
  description: ReactNode;

  /**
   * Visible label for the selector control, or screen-reader legend text for radio mode.
   */
  selectorLabel?: string;

  /**
   * When false, hides the selector while still confirming the first variant.
   */
  showSelector?: boolean;

  /**
   * External in-flight flag from the parent (for example Redux-managed switching).
   */
  busy?: boolean;

  /**
   * Optional status text shown below the body while busy (select mode).
   */
  busyStatus?: ReactNode;

  /**
   * Primary action button label when idle.
   */
  confirmLabel: string;

  /**
   * Primary action button label while busy (radio mode).
   */
  busyConfirmLabel?: string;

  /**
   * Secondary dismiss button label.
   */
  cancelLabel: string;

  /**
   * Applies the selected variant and closes the dialog.
   *
   * @param themeId - Theme id within the plugin manifest.
   */
  onConfirm: (themeId: string) => void | Promise<void>;

  /**
   * Dismisses the picker without changing the active theme.
   */
  onCancel: () => void;
}

/**
 * Modal that lets the user choose which theme variant to apply from a plugin.
 */
export function ThemeVariantPickerModal({
  variants,
  selectionMode,
  title,
  description,
  selectorLabel = 'Theme variant',
  showSelector = true,
  busy = false,
  busyStatus,
  confirmLabel,
  busyConfirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: Props): JSX.Element {
  const titleId = useId();
  const selectId = useId();
  const radioGroupName = useId();
  const [selectedThemeId, setSelectedThemeId] = useState(variants[0]?.id ?? '');
  const [internalBusy, setInternalBusy] = useState(false);
  const effectiveBusy = busy || internalBusy;
  const primaryLabel = effectiveBusy && busyConfirmLabel ? busyConfirmLabel : confirmLabel;

  /**
   * Applies the selected variant and closes the dialog.
   */
  const handleConfirm = useCallback((): void => {
    if (!selectedThemeId) {
      return;
    }
    setInternalBusy(true);
    void (async () => {
      try {
        await onConfirm(selectedThemeId);
      } finally {
        setInternalBusy(false);
      }
    })();
  }, [onConfirm, selectedThemeId]);

  return (
    <Modal
      onClose={onCancel}
      labelledBy={titleId}
      title={title}
      closeDisabled={effectiveBusy}
      disableEscape={effectiveBusy}
    >
      <p className="mb-3 text-[14px] text-muted">{description}</p>
      {showSelector && selectionMode === 'select' ? (
        <FormGroup label={selectorLabel} htmlFor={selectId}>
          <Select
            id={selectId}
            value={selectedThemeId}
            disabled={effectiveBusy || variants.length === 0}
            onChange={(event) => setSelectedThemeId(event.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </Select>
        </FormGroup>
      ) : null}
      {showSelector && selectionMode === 'radio' ? (
        <fieldset className="m-0 space-y-2 border-none p-0">
          <legend className="sr-only">{selectorLabel}</legend>
          {variants.map((variant) => (
            <FormGroup key={variant.id} label={variant.label} layout="checkbox">
              <Radio
                name={radioGroupName}
                checked={selectedThemeId === variant.id}
                onChange={() => setSelectedThemeId(variant.id)}
                disabled={effectiveBusy}
              />
            </FormGroup>
          ))}
        </fieldset>
      ) : null}
      {effectiveBusy && busyStatus ? (
        <StatusMessage className="mt-3">{busyStatus}</StatusMessage>
      ) : null}
      <ModalFooter>
        <Button type="button" variant="secondary" disabled={effectiveBusy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={effectiveBusy || !selectedThemeId}
          onClick={handleConfirm}
        >
          {primaryLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
