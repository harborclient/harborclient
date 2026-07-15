import type { JSX } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';
import type { PluginThemeVariant } from '#/renderer/src/ui/Tabs/Plugins/listPluginThemeVariants';
import { EnableModal } from './EnableModal';
import { UseThemeVariantModal } from './UseThemeVariantModal';

/**
 * State for the multi-variant theme picker shown from the Installed themes page.
 */
export interface UseThemeVariantPickerState {
  /** Theme plugin awaiting variant selection. */
  plugin: PluginInfo;

  /** Selectable variants contributed by the plugin. */
  variants: PluginThemeVariant[];
}

interface Props {
  /**
   * Plugin awaiting enable confirmation after install, if any.
   */
  pendingInstall: PluginInfo | null;

  /**
   * Rejects a pending install and removes the plugin.
   */
  onCancelPendingInstall: () => void;

  /**
   * Confirms a pending install and enables the plugin.
   */
  onConfirmPendingInstall: () => void;

  /**
   * Multi-variant theme picker state for the Installed themes page.
   */
  useThemeVariantPicker: UseThemeVariantPickerState | null;

  /**
   * Closes the variant picker without applying a theme.
   */
  onCloseUseThemeVariantPicker: () => void;

  /**
   * Applies the selected variant from the picker modal.
   */
  onConfirmUseThemeVariant: (themeId: string) => void | Promise<void>;
}

/**
 * Renders enable-permission and theme-variant modals for the Plugins view.
 */
export function PluginModals({
  pendingInstall,
  onCancelPendingInstall,
  onConfirmPendingInstall,
  useThemeVariantPicker,
  onCloseUseThemeVariantPicker,
  onConfirmUseThemeVariant
}: Props): JSX.Element {
  return (
    <>
      {useThemeVariantPicker ? (
        <UseThemeVariantModal
          plugin={useThemeVariantPicker.plugin}
          variants={useThemeVariantPicker.variants}
          onCancel={onCloseUseThemeVariantPicker}
          onConfirm={onConfirmUseThemeVariant}
        />
      ) : null}

      {pendingInstall ? (
        <EnableModal
          plugin={pendingInstall}
          onCancel={onCancelPendingInstall}
          onConfirm={onConfirmPendingInstall}
        />
      ) : null}
    </>
  );
}
