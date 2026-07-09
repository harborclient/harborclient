import { Button } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import type { PluginManagementKind } from './constants';
import { InstalledPluginFooterActions } from './InstalledPluginFooterActions';

interface InstalledProps {
  /**
   * Installed plugin detail actions for an installed row.
   */
  mode: 'installed';

  /**
   * Installed plugin metadata and runtime state.
   */
  plugin: PluginInfo;
}

interface CatalogProps {
  /**
   * Marketplace install action for a catalog listing.
   */
  mode: 'catalog';

  /**
   * Marketplace listing being inspected.
   */
  entry: PluginCatalogEntry;

  /**
   * Whether an install action is in progress for this listing.
   */
  actionBusy: boolean;

  /**
   * Installs the plugin from its git repository URL.
   */
  onInstall: () => void;
}

interface ActionProps {
  /**
   * Whether this screen shows plugins or themes for action copy.
   */
  kind: PluginManagementKind;

  /**
   * Whether a git update is in progress for the open plugin.
   */
  gitUpdateBusy: boolean;

  /**
   * Toggles enablement for the open plugin.
   */
  onToggleEnabled: (plugin: PluginInfo) => void;

  /**
   * Reloads an unpacked plugin from disk.
   */
  onReload: (plugin: PluginInfo) => void;

  /**
   * Re-clones a git-installed plugin from its stored origin.
   */
  onUpdateFromGit: (pluginId: string) => void;

  /**
   * Removes or uninstalls the open plugin after confirmation.
   */
  onRemove: (plugin: PluginInfo) => void;

  /**
   * Switches to this theme plugin when provided on the Installed themes page.
   */
  onUseTheme?: (plugin: PluginInfo) => void;
}

type Props = (InstalledProps | CatalogProps) & ActionProps;

/**
 * Header actions for plugin and theme detail tabs.
 */
export function PluginDetailActions(props: Props): JSX.Element | null {
  if (props.mode === 'installed') {
    return (
      <InstalledPluginFooterActions
        layout="header"
        kind={props.kind}
        plugin={props.plugin}
        gitUpdateBusy={props.gitUpdateBusy}
        onToggleEnabled={props.onToggleEnabled}
        onReload={props.onReload}
        onUpdateFromGit={props.onUpdateFromGit}
        onRemove={props.onRemove}
        onUseTheme={props.onUseTheme}
      />
    );
  }

  return (
    <Button
      type="button"
      disabled={props.actionBusy}
      aria-label={`Install ${props.entry.name}`}
      onClick={props.onInstall}
    >
      {props.actionBusy ? 'Installing…' : 'Install'}
    </Button>
  );
}
