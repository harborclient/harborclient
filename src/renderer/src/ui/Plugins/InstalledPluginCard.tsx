import { useEffect, useState, type JSX, type KeyboardEvent } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { PLUGIN_CATALOG_CATEGORY_LABELS } from '#/shared/plugin/catalogCategories';
import type { PluginInfo } from '#/shared/plugin/types';
import { parsePluginThemeValue } from '#/shared/plugin/types';
import { pluginIsTheme } from '#/shared/plugin/themeCategory';
import type { ThemeSource } from '#/shared/types';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { ErrorMessages } from './ErrorMessages';
import { InstalledPluginFooterActions } from './InstalledPluginFooterActions';
import { resolveInstalledPluginSummary, stopRowActivation } from './helpers';
import { loadInstalledPluginScreenshotSrcs } from './resolvePluginScreenshot';
import { ScreenshotCarousel } from './ScreenshotCarousel';
import { Card } from '@harborclient/sdk/components';

interface Props {
  /**
   * Whether this card represents a plugin or theme for copy in labels.
   */
  kind: PluginManagementKind;

  /**
   * Installed plugin metadata row.
   */
  plugin: PluginInfo;

  /**
   * Matching marketplace catalog entry when the catalog is loaded.
   */
  catalogEntry?: PluginCatalogEntry;

  /**
   * Whether a git update is in progress for this plugin id.
   */
  gitUpdateBusy: boolean;

  /**
   * Opens the installed detail modal for this plugin.
   */
  onOpenDetail: (plugin: PluginInfo) => void;

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
   * Switches to this theme plugin when provided on the Installed themes page.
   */
  onUseTheme?: (plugin: PluginInfo) => void;

  /**
   * Currently active appearance theme preference for active-state labeling.
   */
  activeTheme?: ThemeSource;
}

/**
 * Installed plugin or theme card with marketplace-style preview and footer actions.
 */
export function InstalledPluginCard({
  kind,
  plugin,
  catalogEntry,
  gitUpdateBusy,
  onOpenDetail,
  onToggleEnabled,
  onReload,
  onUpdateFromGit,
  onRemove,
  onUseTheme,
  activeTheme = 'system'
}: Props): JSX.Element {
  const [screenshotSrcs, setScreenshotSrcs] = useState<string[]>([]);
  const summary = resolveInstalledPluginSummary(plugin, catalogEntry);
  const categories = catalogEntry?.categories ?? plugin.manifest.categories ?? [];
  const showCategories = kind !== 'themes' && !pluginIsTheme(plugin) && categories.length > 0;
  const isActiveThemePlugin =
    kind === 'themes' && parsePluginThemeValue(activeTheme)?.pluginId === plugin.id;
  const showStatusBadges =
    plugin.signature?.status === 'invalid' ||
    plugin.signature?.status === 'untrusted' ||
    (plugin.runtimeError != null && plugin.enabled);

  /**
   * Loads screenshot previews for the card from manifest assets or catalog URLs.
   */
  useEffect(() => {
    let active = true;

    void loadInstalledPluginScreenshotSrcs(
      plugin,
      catalogEntry?.screenshots,
      catalogEntry?.screenshot
    ).then((srcs) => {
      if (active) {
        setScreenshotSrcs(srcs);
      }
    });

    return () => {
      active = false;
    };
  }, [plugin, catalogEntry]);

  /**
   * Opens the detail modal when the card body is activated from the keyboard.
   *
   * @param event - Keyboard event on the card body.
   */
  const handleBodyKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(plugin);
    }
  };

  /**
   * Opens the detail modal when the card body is clicked.
   */
  const handleBodyClick = (): void => {
    onOpenDetail(plugin);
  };

  return (
    <li>
      <Card>
        {screenshotSrcs.length > 0 ? (
          <ScreenshotCarousel variant="card" images={screenshotSrcs} stopPropagation />
        ) : (
          <div
            className="flex aspect-video w-full items-center justify-center border-b border-separator bg-panel text-[14px] text-muted"
            aria-hidden
          >
            No preview
          </div>
        )}

        <Card.Body
          tabIndex={0}
          role="button"
          className="flex flex-1 cursor-pointer flex-col gap-1.5 hover:bg-selection/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          aria-label={`View details for ${plugin.name}`}
          onClick={handleBodyClick}
          onKeyDown={handleBodyKeyDown}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">
              {plugin.name}
            </h3>
            <span className="shrink-0 text-[14px] text-muted">{plugin.version}</span>
          </div>
          {summary ? <p className="m-0 line-clamp-3 text-[14px] text-text">{summary}</p> : null}
          {isActiveThemePlugin ? (
            <span className="text-[14px] text-accent" role="status">
              Active theme
            </span>
          ) : null}
          {showCategories ? (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text"
                >
                  {PLUGIN_CATALOG_CATEGORY_LABELS[category]}
                </span>
              ))}
            </div>
          ) : null}
          {showStatusBadges ? (
            <div className={`flex flex-wrap gap-1.5 pt-1.5${showCategories ? '' : ' mt-auto'}`}>
              {plugin.signature?.status === 'invalid' ? (
                <span className="rounded bg-danger/20 px-2 py-0.5 text-[14px] text-danger">
                  Invalid signature
                </span>
              ) : null}
              {plugin.signature?.status === 'untrusted' ? (
                <span className="rounded bg-danger/20 px-2 py-0.5 text-[14px] text-danger">
                  Untrusted publisher
                </span>
              ) : null}
              {plugin.runtimeError && plugin.enabled ? (
                <span className="rounded bg-danger/20 px-2 py-0.5 text-[14px] text-danger">
                  Error
                </span>
              ) : null}
            </div>
          ) : null}
          <ErrorMessages plugin={plugin} />
        </Card.Body>

        <div
          className="flex flex-wrap gap-2 border-t border-separator p-3"
          onClick={stopRowActivation}
          onMouseDown={stopRowActivation}
        >
          <InstalledPluginFooterActions
            kind={kind}
            plugin={plugin}
            gitUpdateBusy={gitUpdateBusy}
            onToggleEnabled={onToggleEnabled}
            onReload={onReload}
            onUpdateFromGit={onUpdateFromGit}
            onRemove={onRemove}
            onUseTheme={onUseTheme}
            stopPropagation
          />
        </div>
      </Card>
    </li>
  );
}
