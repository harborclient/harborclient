import { FooterPanel } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX, type ReactNode } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { LivePageSettingsForm } from '#/renderer/src/ui/Tabs/LivePageSettings/LivePageSettingsForm';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Browser tab whose settings are shown in the panel.
   */
  browserTab: BrowserTab;

  /**
   * Closes the live page settings footer panel.
   */
  onClose: () => void;
}

/**
 * Slide-up, resizable footer panel for editing the active live page's settings.
 *
 * Mirrors {@link LiveServerPanel}: title/description/Save/close in the FooterPanel
 * header, sticky segmented tabs, and a scrollable body for the form sections.
 *
 * @param props - Open state, linked browser tab, and close handler.
 * @returns Footer panel with live page settings form.
 */
export function LivePageSettingsPanel({ open, browserTab, onClose }: Props): JSX.Element {
  const [headerButtons, setHeaderButtons] = useState<ReactNode[] | undefined>();

  /**
   * Receives the Save control from the form for the FooterPanel header.
   *
   * @param actions - Save button node, or null when the form unmounts.
   */
  const handleHeaderActionsChange = useCallback((actions: ReactNode | null): void => {
    setHeaderButtons(actions == null ? undefined : [actions]);
  }, []);

  return (
    <FooterPanel
      id="footer-live-page-settings-panel"
      open={open}
      onClose={onClose}
      closeLabel="live page settings"
      storageKey="hc.livePageSettingsPanelHeight"
      title="Live Page Settings"
      description="Manage live page settings and configuration."
      buttons={headerButtons}
      unmountWhenClosed
    >
      <LivePageSettingsForm
        key={browserTab.tabId}
        browserTab={browserTab}
        onClose={onClose}
        onHeaderActionsChange={handleHeaderActionsChange}
      />
    </FooterPanel>
  );
}
