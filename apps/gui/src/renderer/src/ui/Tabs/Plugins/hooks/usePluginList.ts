import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginInfo } from '@harborclient/core/plugin/types';
import { coalesceInFlightRefresh, shouldSetLoadingForPluginListRefresh } from './pluginListRefresh';

interface UsePluginListResult {
  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Whether the initial plugin list load has not completed yet.
   * Subsequent refreshes stay false so the installed grid remains mounted.
   */
  loading: boolean;

  /**
   * Load error message, if any.
   */
  error: string | null;

  /**
   * Reloads the plugin list from the main process without unmounting the grid
   * after the first successful load.
   */
  refresh: () => Promise<PluginInfo[]>;
}

/**
 * Loads and refreshes the installed plugin list, subscribing to main-process change events.
 */
export function usePluginList(): UsePluginListResult {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const inFlightRef = useRef<Promise<PluginInfo[]> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Loads the plugin list from the main process.
   *
   * The first call sets `loading` until it settles. Later calls update `plugins`
   * in place so InstalledView does not blink on toggle/reload.
   *
   * @returns Fresh plugin rows from the main process.
   */
  const refresh = useCallback(async (): Promise<PluginInfo[]> => {
    return coalesceInFlightRefresh(inFlightRef, async () => {
      const willSetLoading = shouldSetLoadingForPluginListRefresh(hasLoadedOnceRef.current);
      if (willSetLoading && mountedRef.current) {
        setLoading(true);
      }
      if (mountedRef.current) {
        setError(null);
      }
      try {
        const next = await window.api.listPlugins();
        if (mountedRef.current) {
          setPlugins(next);
          setError(null);
        }
        hasLoadedOnceRef.current = true;
        return next;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return [];
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    });
  }, []);

  /**
   * Loads plugins on mount and when the main process reports changes.
   */
  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const unsubscribe = window.api.onPluginsChanged(() => {
      void refresh();
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [refresh]);

  return { plugins, loading, error, refresh };
}
