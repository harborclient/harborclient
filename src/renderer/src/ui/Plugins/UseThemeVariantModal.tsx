import { Button, FormGroup, Modal, ModalFooter, Select } from '@harborclient/sdk/components';
import { useCallback, useId, useState, type JSX } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';
import type { PluginThemeVariant } from '#/renderer/src/ui/Plugins/listPluginThemeVariants';

interface Props {
  /**
   * Theme plugin the user is switching to.
   */
  plugin: PluginInfo;

  /**
   * Selectable theme variants contributed by the plugin.
   */
  variants: PluginThemeVariant[];

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
 * Formats a variant label for the picker dropdown, including its appearance family.
 *
 * @param variant - Theme variant contributed by the plugin.
 * @returns Human-readable option label.
 */
function formatVariantLabel(variant: PluginThemeVariant): string {
  const typeLabel = variant.type === 'high-contrast' ? 'High contrast' : variant.type;
  return `${variant.title} (${typeLabel})`;
}

/**
 * Modal that lets the user choose which variant to apply from a multi-theme plugin.
 */
export function UseThemeVariantModal({
  plugin,
  variants,
  onConfirm,
  onCancel
}: Props): JSX.Element {
  const selectId = useId();
  const [selectedThemeId, setSelectedThemeId] = useState(variants[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  /**
   * Applies the selected variant and closes the dialog.
   */
  const handleConfirm = useCallback((): void => {
    if (!selectedThemeId) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await onConfirm(selectedThemeId);
      } finally {
        setBusy(false);
      }
    })();
  }, [onConfirm, selectedThemeId]);

  return (
    <Modal
      onClose={onCancel}
      labelledBy="use-theme-variant-title"
      title={`Use ${plugin.name}`}
      closeDisabled={busy}
      disableEscape={busy}
    >
      <p className="mb-3 text-[14px] text-text">Choose which variant of {plugin.name} to apply.</p>
      <FormGroup label="Theme variant" htmlFor={selectId}>
        <Select
          id={selectId}
          value={selectedThemeId}
          disabled={busy || variants.length === 0}
          onChange={(event) => setSelectedThemeId(event.target.value)}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {formatVariantLabel(variant)}
            </option>
          ))}
        </Select>
      </FormGroup>
      {busy ? (
        <p className="mt-3 text-[14px] text-muted" role="status">
          Applying theme…
        </p>
      ) : null}
      <ModalFooter>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={busy || !selectedThemeId}
          onClick={handleConfirm}
        >
          Use theme
        </Button>
      </ModalFooter>
    </Modal>
  );
}
