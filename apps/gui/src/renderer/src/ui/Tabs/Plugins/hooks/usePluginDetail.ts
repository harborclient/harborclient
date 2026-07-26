import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PluginCatalogEntry } from '@harborclient/core/plugin/catalog';
import type { PluginInfo } from '@harborclient/core/plugin/types';
import { installedPluginScreenshotIdentity } from '../installedPluginScreenshotIdentity';
import { loadInstalledPluginScreenshotSrcs } from '../resolvePluginScreenshot';

interface UsePluginDetailArgs {
  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Marketplace catalog entries keyed by plugin id.
   */
  catalogById: Map<string, PluginCatalogEntry>;
}

interface UsePluginDetailResult {
  /**
   * Plugin currently shown in the installed detail modal, if any.
   */
  detailPlugin: PluginInfo | null;

  /**
   * Loaded description markdown for the detail modal.
   */
  descriptionMarkdown: string;

  /**
   * Load state for the detail description markdown.
   */
  descriptionLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Screenshot URLs for the detail modal.
   */
  detailScreenshotSrcs: string[];

  /**
   * Opens the read-only detail modal for one installed plugin.
   */
  openDetail: (plugin: PluginInfo) => void;

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  closeDetail: () => void;
}

/**
 * Manages installed plugin detail modal state, description loading, and screenshots.
 */
export function usePluginDetail({
  plugins,
  catalogById
}: UsePluginDetailArgs): UsePluginDetailResult {
  const [detailPluginId, setDetailPluginId] = useState<string | null>(null);
  const [descriptionMarkdown, setDescriptionMarkdown] = useState<string>('');
  const [descriptionLoadState, setDescriptionLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [detailScreenshotSrcs, setDetailScreenshotSrcs] = useState<string[]>([]);
  const openPluginIdRef = useRef<string | null>(null);

  /**
   * Resolves the open detail plugin from the latest installed plugin list.
   */
  const detailPlugin = useMemo(() => {
    if (!detailPluginId) {
      return null;
    }
    return plugins.find((plugin) => plugin.id === detailPluginId) ?? null;
  }, [detailPluginId, plugins]);

  /**
   * Opens the read-only detail modal for one installed plugin.
   *
   * @param plugin - Plugin row to inspect.
   */
  const openDetail = useCallback((plugin: PluginInfo): void => {
    // Re-opening the same plugin happens on every plugins:changed refresh.
    // Clearing loaded assets there blanks the screenshot and description.
    if (openPluginIdRef.current === plugin.id) {
      return;
    }

    openPluginIdRef.current = plugin.id;
    setDescriptionMarkdown('');
    setDescriptionLoadState(plugin.manifest.description ? 'loading' : 'idle');
    setDetailScreenshotSrcs([]);
    setDetailPluginId(plugin.id);
  }, []);

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  const closeDetail = useCallback((): void => {
    openPluginIdRef.current = null;
    setDetailPluginId(null);
    setDescriptionMarkdown('');
    setDescriptionLoadState('idle');
    setDetailScreenshotSrcs([]);
  }, []);

  const descriptionPath = detailPlugin?.manifest.description;
  const detailCatalogEntry = detailPlugin ? catalogById.get(detailPlugin.id) : undefined;

  /**
   * Stable screenshot identity so enable/reload refreshes do not rebuild data URLs
   * and collapse the detail-tab preview height while the image reloads.
   */
  const screenshotIdentity = useMemo(() => {
    if (!detailPlugin) {
      return null;
    }
    return installedPluginScreenshotIdentity(detailPlugin, detailCatalogEntry);
  }, [detailPlugin, detailCatalogEntry]);

  /**
   * Loads the detail plugin description markdown when the detail view opens or
   * the description asset path changes — not on every plugin list object refresh.
   */
  useEffect(() => {
    let active = true;
    if (!detailPluginId || !descriptionPath) {
      return () => {
        active = false;
      };
    }
    void window.api
      .readPluginAsset(detailPluginId, descriptionPath)
      .then((asset) => {
        if (active) {
          setDescriptionMarkdown(atob(asset.content));
          setDescriptionLoadState('loaded');
        }
      })
      .catch(() => {
        if (active) {
          setDescriptionMarkdown('');
          setDescriptionLoadState('error');
        }
      });
    return () => {
      active = false;
    };
  }, [detailPluginId, descriptionPath]);

  /**
   * Loads installed plugin screenshots when screenshot-relevant fields change.
   * Skips enablement-only list refreshes that would otherwise swap in new data
   * URLs and shrink the tab carousel to 0px until decode finishes.
   */
  useEffect(() => {
    let active = true;
    if (!detailPlugin || !screenshotIdentity) {
      return () => {
        active = false;
      };
    }

    void loadInstalledPluginScreenshotSrcs(
      detailPlugin,
      detailCatalogEntry?.screenshots,
      detailCatalogEntry?.screenshot
    ).then((screenshotSrcs) => {
      if (!active) {
        return;
      }
      setDetailScreenshotSrcs((previous) => {
        if (
          previous.length === screenshotSrcs.length &&
          previous.every((src, index) => src === screenshotSrcs[index])
        ) {
          return previous;
        }
        return screenshotSrcs;
      });
    });

    return () => {
      active = false;
    };
    // screenshotIdentity gates reloads; detailPlugin/catalog are read for that identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow deps
  }, [screenshotIdentity]);

  return {
    detailPlugin,
    descriptionMarkdown,
    descriptionLoadState,
    detailScreenshotSrcs,
    openDetail,
    closeDetail
  };
}
