import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
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
    setDescriptionMarkdown('');
    setDescriptionLoadState(plugin.manifest.description ? 'loading' : 'idle');
    setDetailScreenshotSrcs([]);
    setDetailPluginId(plugin.id);
  }, []);

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  const closeDetail = useCallback((): void => {
    setDetailPluginId(null);
    setDescriptionMarkdown('');
    setDescriptionLoadState('idle');
    setDetailScreenshotSrcs([]);
  }, []);

  /**
   * Loads the detail plugin description markdown when the detail modal opens.
   */
  useEffect(() => {
    let active = true;
    const descriptionPath = detailPlugin?.manifest.description;
    if (!detailPlugin || !descriptionPath) {
      return () => {
        active = false;
      };
    }
    void window.api
      .readPluginAsset(detailPlugin.id, descriptionPath)
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
  }, [detailPlugin]);

  /**
   * Loads the installed plugin screenshot when the detail modal opens.
   */
  useEffect(() => {
    let active = true;
    if (!detailPlugin) {
      return () => {
        active = false;
      };
    }

    void loadInstalledPluginScreenshotSrcs(
      detailPlugin,
      catalogById.get(detailPlugin.id)?.screenshots,
      catalogById.get(detailPlugin.id)?.screenshot
    ).then((screenshotSrcs) => {
      if (active) {
        setDetailScreenshotSrcs(screenshotSrcs);
      }
    });

    return () => {
      active = false;
    };
  }, [detailPlugin, catalogById]);

  return {
    detailPlugin,
    descriptionMarkdown,
    descriptionLoadState,
    detailScreenshotSrcs,
    openDetail,
    closeDetail
  };
}
