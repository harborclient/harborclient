import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { PluginCatalog, PluginSource, PluginSourcesSettings } from '#/shared/plugin/catalog';
import { getDefaultPluginSources, pluginSourcesSchema } from '#/shared/plugin/catalog';
import type { TeamHubPluginSource } from '#/shared/types';
import { formatIpcErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import type { PluginsSidebarSection } from '../sidebarTypes';
import type { SourceKind } from '../types';

interface UsePluginSourcesArgs {
  /**
   * Active sidebar section, used to reload the catalog after saving on Marketplace.
   */
  activeSection: PluginsSidebarSection;

  /**
   * Clears the cached catalog so it can be reloaded after source changes.
   */
  setCatalog: Dispatch<SetStateAction<PluginCatalog | null>>;

  /**
   * Loads the marketplace catalog from configured sources.
   */
  loadCatalog: () => Promise<void>;
}

interface UsePluginSourcesResult {
  /**
   * Draft plugin source settings edited on the Settings page.
   */
  pluginSourcesDraft: PluginSourcesSettings;

  /**
   * Whether settings are being loaded or saved.
   */
  pluginSourcesBusy: boolean;

  /**
   * Load or save error message for plugin sources.
   */
  pluginSourcesLoadError: string | null;

  /**
   * Whether persisted plugin sources have been loaded at least once.
   */
  pluginSourcesLoaded: boolean;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  teamHubPluginSources: {
    catalogs: TeamHubPluginSource[];
    trusted: TeamHubPluginSource[];
  };

  /**
   * Loads persisted plugin source settings for the Settings page.
   */
  loadPluginSources: () => Promise<void>;

  /**
   * Replaces the draft plugin source settings with HarborClient defaults.
   */
  resetPluginSourcesDraft: () => void;

  /**
   * Updates one draft plugin source row.
   */
  updatePluginSourceDraft: (kind: SourceKind, index: number, source: PluginSource) => void;

  /**
   * Removes one draft plugin source row.
   */
  removePluginSourceDraft: (kind: SourceKind, index: number) => void;

  /**
   * Adds one draft plugin source row.
   */
  addPluginSourceDraft: (kind: SourceKind, url: string) => string | null;

  /**
   * Persists draft plugin source settings and refreshes the marketplace catalog.
   */
  savePluginSources: () => Promise<void>;
}

/**
 * Manages plugin marketplace source endpoint draft state, loading, and persistence.
 */
export function usePluginSources({
  activeSection,
  setCatalog,
  loadCatalog
}: UsePluginSourcesArgs): UsePluginSourcesResult {
  const [pluginSourcesDraft, setPluginSourcesDraft] =
    useState<PluginSourcesSettings>(getDefaultPluginSources());
  const [pluginSourcesBusy, setPluginSourcesBusy] = useState(false);
  const [pluginSourcesLoadError, setPluginSourcesLoadError] = useState<string | null>(null);
  const [pluginSourcesLoaded, setPluginSourcesLoaded] = useState(false);
  const [teamHubPluginSources, setTeamHubPluginSources] = useState<{
    catalogs: TeamHubPluginSource[];
    trusted: TeamHubPluginSource[];
  }>({ catalogs: [], trusted: [] });

  /**
   * Loads persisted plugin source settings for the Settings page.
   */
  const loadPluginSources = useCallback(async (): Promise<void> => {
    setPluginSourcesLoadError(null);
    setPluginSourcesBusy(true);
    try {
      const [settings, hubSources] = await Promise.all([
        window.api.getPluginSources(),
        window.api.getTeamHubPluginSources()
      ]);
      setPluginSourcesDraft(settings);
      setTeamHubPluginSources(hubSources);
      setPluginSourcesLoaded(true);
    } catch (err) {
      setPluginSourcesLoadError(err instanceof Error ? err.message : String(err));
      setPluginSourcesDraft(getDefaultPluginSources());
      setTeamHubPluginSources({ catalogs: [], trusted: [] });
    } finally {
      setPluginSourcesBusy(false);
    }
  }, []);

  /**
   * Replaces the draft plugin source settings with HarborClient defaults.
   */
  const resetPluginSourcesDraft = useCallback((): void => {
    setPluginSourcesDraft(getDefaultPluginSources());
    setPluginSourcesLoadError(null);
  }, []);

  /**
   * Updates one draft plugin source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  const updatePluginSourceDraft = useCallback(
    (kind: SourceKind, index: number, source: PluginSource): void => {
      setPluginSourcesDraft((current) => ({
        ...current,
        [kind]: current[kind].map((entry, entryIndex) => (entryIndex === index ? source : entry))
      }));
    },
    []
  );

  /**
   * Removes one draft plugin source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index to remove.
   */
  const removePluginSourceDraft = useCallback((kind: SourceKind, index: number): void => {
    setPluginSourcesDraft((current) => ({
      ...current,
      [kind]: current[kind].filter((_entry, entryIndex) => entryIndex !== index)
    }));
  }, []);

  /**
   * Adds one draft plugin source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param url - Endpoint URL to append.
   * @returns Validation error message, or null when the row was added.
   */
  const addPluginSourceDraft = useCallback((kind: SourceKind, url: string): string | null => {
    let validationError: string | null = null;
    setPluginSourcesDraft((current) => {
      const candidate: PluginSourcesSettings = {
        ...current,
        [kind]: [...current[kind], { url, enabled: true }]
      };
      const parsed = pluginSourcesSchema.safeParse(candidate);
      if (!parsed.success) {
        validationError = 'Enter a valid http:// or https:// URL.';
        return current;
      }
      return parsed.data;
    });
    return validationError;
  }, []);

  /**
   * Persists draft plugin source settings and refreshes the marketplace catalog.
   */
  const savePluginSources = useCallback(async (): Promise<void> => {
    setPluginSourcesBusy(true);
    setPluginSourcesLoadError(null);
    try {
      const saved = await window.api.setPluginSources(pluginSourcesDraft);
      setPluginSourcesDraft(saved);
      setCatalog(null);
      if (activeSection === 'marketplace') {
        await loadCatalog();
      }
      toast.success('Plugin sources saved.');
    } catch (err) {
      setPluginSourcesLoadError(
        formatIpcErrorMessage(err, 'Plugin source settings could not be saved.')
      );
    } finally {
      setPluginSourcesBusy(false);
    }
  }, [pluginSourcesDraft, activeSection, setCatalog, loadCatalog]);

  return {
    pluginSourcesDraft,
    pluginSourcesBusy,
    pluginSourcesLoadError,
    pluginSourcesLoaded,
    teamHubPluginSources,
    loadPluginSources,
    resetPluginSourcesDraft,
    updatePluginSourceDraft,
    removePluginSourceDraft,
    addPluginSourceDraft,
    savePluginSources
  };
}
