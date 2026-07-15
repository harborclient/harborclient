import { FooterPanel } from '@harborclient/sdk/components';
import { type JSX } from 'react';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import type { PluginContributionKind } from '#/shared/plugin/pluginSurface';

interface Props {
  /**
   * Namespaced panel id used for DOM ids and height persistence.
   */
  id: string;

  /**
   * Plugin manifest id.
   */
  pluginId: string;

  /**
   * Manifest footerPanels contribution id.
   */
  contributionId: string;

  /**
   * Display title for the close button accessible name.
   */
  title: string;

  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the hosted footer panel.
   */
  onClose: () => void;
}

/**
 * Host-owned resizable shell for plugin footer panels.
 */
export function HostedFooterPanel({
  id,
  pluginId,
  contributionId,
  title,
  open,
  onClose
}: Props): JSX.Element {
  const kind: PluginContributionKind = 'footerPanels';

  return (
    <FooterPanel
      id={`footer-plugin-panel-${id}`}
      open={open}
      onClose={onClose}
      closeLabel={title}
      storageKey={`hc.footerPanel.${id}`}
      unmountWhenClosed
    >
      <HostedSurface
        pluginId={pluginId}
        contributionId={contributionId}
        kind={kind}
        minHeight={160}
        className="h-full"
        resizeMode="fill"
      />
    </FooterPanel>
  );
}
