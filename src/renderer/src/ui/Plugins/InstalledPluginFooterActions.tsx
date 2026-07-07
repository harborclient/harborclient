import { Button } from '@harborclient/sdk/components';
import type { JSX, MouseEvent } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { pluginManagementNoun } from '#/renderer/src/ui/Plugins/constants';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';
import { isManagedInstall } from './helpers';
import {
  installedCardToggleLabel,
  resolveInstalledCardMiddleAction
} from './installedPluginCardHelpers';

interface Props {
  /**
   * Whether this row represents a plugin or theme for copy in labels.
   */
  kind: PluginManagementKind;

  /**
   * Installed plugin metadata row.
   */
  plugin: PluginInfo;

  /**
   * Whether a git update is in progress for this plugin id.
   */
  gitUpdateBusy: boolean;

  /**
   * Toggles enablement for this plugin.
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
   * Removes or uninstalls this plugin after confirmation.
   */
  onRemove: (plugin: PluginInfo) => void;

  /**
   * When true, click handlers call `stopPropagation` so card body activation
   * does not fire. Omit in modal footers where propagation is not an issue.
   */
  stopPropagation?: boolean;

  /**
   * Switches to this theme plugin when provided on the Installed themes page.
   */
  onUseTheme?: (plugin: PluginInfo) => void;
}

/**
 * Enable/disable, update/reload, and remove buttons shared by installed plugin
 * cards and the plugin detail modal footer.
 */
export function InstalledPluginFooterActions({
  kind,
  plugin,
  gitUpdateBusy,
  onToggleEnabled,
  onReload,
  onUpdateFromGit,
  onRemove,
  stopPropagation = false,
  onUseTheme
}: Props): JSX.Element {
  const noun = pluginManagementNoun(kind);
  const middleAction = resolveInstalledCardMiddleAction(plugin);
  const toggleLabel = installedCardToggleLabel(plugin.enabled);
  const removeLabel = isManagedInstall(plugin) ? 'Uninstall' : 'Remove';
  const showUseTheme = kind === 'themes' && onUseTheme != null;

  /**
   * Stops event bubbling when embedded in an activatable card row.
   *
   * @param event - Click event on a footer button.
   */
  const handleClickStop =
    (action: () => void) =>
    (event: MouseEvent<HTMLButtonElement>): void => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      action();
    };

  return (
    <>
      {showUseTheme ? (
        <Button
          type="button"
          variant="toolbar"
          className="min-w-0 flex-1 justify-center"
          aria-label={`Use ${plugin.name}`}
          onClick={handleClickStop(() => onUseTheme(plugin))}
        >
          Use
        </Button>
      ) : (
        <Button
          type="button"
          variant="toolbar"
          className="min-w-0 flex-1 justify-center"
          aria-label={`${toggleLabel} ${plugin.name}`}
          onClick={handleClickStop(() => onToggleEnabled(plugin))}
        >
          {toggleLabel}
        </Button>
      )}
      {middleAction === 'update' ? (
        <Button
          type="button"
          variant="toolbar"
          className="min-w-0 flex-1 justify-center"
          disabled={gitUpdateBusy}
          aria-label={`Update ${plugin.name}`}
          onClick={handleClickStop(() => onUpdateFromGit(plugin.id))}
        >
          {gitUpdateBusy ? 'Updating…' : 'Update'}
        </Button>
      ) : null}
      {middleAction === 'reload' ? (
        <Button
          type="button"
          variant="toolbar"
          className="min-w-0 flex-1 justify-center"
          aria-label={`Reload ${plugin.name}`}
          onClick={handleClickStop(() => onReload(plugin))}
        >
          Reload
        </Button>
      ) : null}
      <Button
        type="button"
        variant="toolbar"
        className={`min-w-0 flex-1 justify-center ${toolbarDangerButtonClass}`}
        aria-label={`${removeLabel} ${noun} ${plugin.name}`}
        onClick={handleClickStop(() => onRemove(plugin))}
      >
        {removeLabel}
      </Button>
    </>
  );
}
