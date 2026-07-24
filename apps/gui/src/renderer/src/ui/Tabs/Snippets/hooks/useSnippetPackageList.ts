import { useCallback, useEffect, useState } from 'react';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';

interface UseSnippetPackageListResult {
  installedPackages: InstalledSnippetPackage[];
  packagesLoading: boolean;
  packagesError: string | null;
  refreshPackages: () => Promise<InstalledSnippetPackage[]>;
}

/**
 * Loads installed snippet marketplace bundle summaries from the main process.
 */
export function useSnippetPackageList(): UseSnippetPackageListResult {
  const [installedPackages, setInstalledPackages] = useState<InstalledSnippetPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  /**
   * Refreshes installed marketplace bundle summaries.
   *
   * @returns Fresh installed package rows from the main process.
   */
  const refreshPackages = useCallback(async (): Promise<InstalledSnippetPackage[]> => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const next = await window.api.listInstalledSnippetPackages();
      setInstalledPackages(next);
      return next;
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  /**
   * Loads installed package summaries on mount.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .listInstalledSnippetPackages()
      .then((next) => {
        if (active) {
          setInstalledPackages(next);
          setPackagesLoading(false);
          setPackagesError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setPackagesError(err instanceof Error ? err.message : String(err));
          setPackagesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    installedPackages,
    packagesLoading,
    packagesError,
    refreshPackages
  };
}
