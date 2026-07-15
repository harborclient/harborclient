import { ThemeVariantPickerModal } from '@harborclient/sdk/components';
import type { JSX } from 'react';
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
  return (
    <ThemeVariantPickerModal
      variants={variants.map((variant) => ({
        id: variant.id,
        label: formatVariantLabel(variant)
      }))}
      selectionMode="select"
      title={`Use ${plugin.name}`}
      description={`Choose which variant of ${plugin.name} to apply.`}
      selectorLabel="Theme variant"
      busyStatus="Applying theme…"
      confirmLabel="Use theme"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
