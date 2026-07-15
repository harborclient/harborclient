import { useCallback, useEffect, useState } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';

interface UsePluginListResult {
  /**
   * Installed plugin rows from the main process.
   */
  plugins: PluginInfo[];

  /**
   * Whether the plugin list is loading.
   */
  loading: boolean;

  /**
   * Load error message, if any.
   */
  error: string | null;

  /**
   * Reloads the plugin list from the main process.
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

  /**
   * Loads the plugin list from the main process.
   *
   * @returns Fresh plugin rows from the main process.
   */
  const refresh = useCallback(async (): Promise<PluginInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const next = await window.api.listPlugins();
      setPlugins(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads plugins on mount and when the main process reports changes.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .listPlugins()
      .then((next) => {
        if (active) {
          setPlugins(next);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    const unsubscribe = window.api.onPluginsChanged(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  return { plugins, loading, error, refresh };
}
