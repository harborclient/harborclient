import { useCallback, useEffect, useState } from 'react';
import type { CollectionProviderKind, StorageProvider } from '@harborclient/core/types';
import { subscribeStorageConnectionsChanged } from './subscribeStorageConnectionsChanged';

/**
 * Unified collection provider entry for database connections and team hubs.
 */
export interface ProviderOption {
  /**
   * Provider connection id used as collection `connectionId`.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * Whether the provider is a local/remote database or a team hub.
   */
  kind: 'database' | 'team-hub';

  /**
   * Database engine type when {@link ProviderOption.kind} is `database`.
   */
  type?: StorageProvider;
}

/**
 * Options for {@link useProviders} that control which team hubs appear in the list.
 */
export interface UseProvidersOptions {
  /**
   * Deprecated no-op. Admin tokens have data API access and remain in provider lists.
   */
  excludeAdminTeamHubs?: boolean;

  /**
   * When true, omits team hubs whose servers do not expose snippet storage routes.
   */
  excludeSnippetUnsupportedTeamHubs?: boolean;

  /**
   * When true, omits team hubs whose servers do not expose live-server routes.
   */
  excludeLiveServerUnsupportedTeamHubs?: boolean;

  /**
   * When true, omits team hubs whose servers do not expose live-page routes.
   */
  excludeLivePageUnsupportedTeamHubs?: boolean;

  /**
   * Provider id to keep in the list even when it is an admin hub (current collection provider).
   */
  retainConnectionId?: string;

  /**
   * When true, omits git-backed storage connections from collection provider pickers.
   */
  excludeGit?: boolean;
}

/**
 * Loaded provider list and bootstrap state from IPC.
 */
export interface ProvidersState {
  /**
   * Database connections and team hubs available as collection providers.
   */
  providers: ProviderOption[];

  /**
   * Active provider id used for new collections when none is chosen explicitly.
   */
  primaryProviderId: string;

  /**
   * True while the initial or retried IPC load is in flight.
   */
  loading: boolean;

  /**
   * User-facing message when the IPC bootstrap fails; null on success or before first attempt.
   */
  error: string | null;

  /**
   * Re-runs the IPC bootstrap (clears error and sets loading).
   */
  reload: () => void;
}

/**
 * Returns a display label suffix for a provider option.
 *
 * @param provider - Provider option from {@link useProviders}.
 */
export function providerOptionLabel(provider: ProviderOption): string {
  if (provider.kind === 'team-hub') {
    return 'Team Hub';
  }
  const labels: Record<StorageProvider, string> = {
    sqlite: 'SQLite',
    git: 'Git',
    firestore: 'Firestore',
    mysql: 'MySQL',
    postgres: 'PostgreSQL'
  };
  return labels[provider.type ?? 'sqlite'];
}

/**
 * Returns providers suitable for collection pickers.
 *
 * Admin hubs are included — admin tokens also have data API access.
 *
 * @param providers - Full merged provider list from IPC.
 * @returns Provider options for collection provider dropdowns.
 */
export function filterCollectionProviders(providers: ProviderOption[]): ProviderOption[] {
  return providers;
}

/**
 * Builds hub ids whose servers do not expose snippet storage routes.
 *
 * @param scanResults - Session scan results from IPC, or undefined when the scan failed.
 * @returns Hub ids that failed the snippet route probe.
 */
function snippetUnsupportedHubIdsFromScanResults(
  scanResults: Awaited<ReturnType<typeof window.api.scanTeamHubSessions>> | undefined
): Set<string> {
  const unsupportedHubIds = new Set<string>();
  if (scanResults === undefined) {
    return unsupportedHubIds;
  }

  for (const result of scanResults) {
    if (!result.services.snippets) {
      unsupportedHubIds.add(result.hubId);
    }
  }

  return unsupportedHubIds;
}

/**
 * Builds hub ids whose servers do not expose the requested live-entity routes.
 *
 * @param scanResults - Session scan results from IPC, or undefined when the scan failed.
 * @param service - Live entity service flag to inspect.
 * @returns Hub ids that failed the requested route probe.
 */
function liveEntityUnsupportedHubIdsFromScanResults(
  scanResults: Awaited<ReturnType<typeof window.api.scanTeamHubSessions>> | undefined,
  service: 'liveServers' | 'livePages'
): Set<string> {
  const unsupportedHubIds = new Set<string>();
  if (scanResults === undefined) {
    return unsupportedHubIds;
  }
  for (const result of scanResults) {
    if (result.services[service] !== true) {
      unsupportedHubIds.add(result.hubId);
    }
  }
  return unsupportedHubIds;
}

/**
 * Removes team hubs that failed the snippet route probe from a provider list.
 *
 * @param providers - Full merged provider list from IPC.
 * @param unsupportedHubIds - Hub connection ids without snippet storage routes.
 * @param retainConnectionId - Optional provider id to keep even when snippets are unsupported.
 * @returns Filtered provider options safe to show in snippet storage pickers.
 */
export function filterSnippetProviders(
  providers: ProviderOption[],
  unsupportedHubIds: ReadonlySet<string>,
  retainConnectionId?: string
): ProviderOption[] {
  return providers.filter(
    (provider) =>
      provider.kind !== 'team-hub' ||
      !unsupportedHubIds.has(provider.id) ||
      provider.id === retainConnectionId
  );
}

/**
 * Resolves the default provider id from a filtered provider list.
 *
 * @param providers - Provider options after optional admin-hub filtering.
 * @param activeDatabaseId - Active storage connection id from settings.
 * @returns Provider id to use when none is chosen explicitly.
 */
function resolvePrimaryProviderId(providers: ProviderOption[], activeDatabaseId: string): string {
  return (
    providers.find((provider) => provider.id === activeDatabaseId)?.id ??
    providers.find((provider) => provider.kind === 'database')?.id ??
    providers[0]?.id ??
    ''
  );
}

/**
 * Removes git-backed database connections from a provider list for collection pickers.
 *
 * @param providers - Full merged provider list from IPC.
 * @param retainConnectionId - Optional provider id to keep even when it is git-backed.
 * @returns Filtered provider options without git storage locations.
 */
export function filterGitProviders(
  providers: ProviderOption[],
  retainConnectionId?: string
): ProviderOption[] {
  return providers.filter(
    (provider) => provider.type !== 'git' || provider.id === retainConnectionId
  );
}

/**
 * Loads database connections and team hubs via IPC and merges them into one provider list.
 *
 * @param deps - Optional effect dependencies; when they change the hook refetches.
 * @param options - Optional filtering for collection provider pickers.
 * @returns Provider list, primary id, loading/error flags, and a reload callback.
 */
export function useProviders(
  deps: readonly unknown[] = [],
  options: UseProvidersOptions = {}
): ProvidersState {
  const {
    excludeAdminTeamHubs = false,
    excludeSnippetUnsupportedTeamHubs = false,
    excludeLiveServerUnsupportedTeamHubs = false,
    excludeLivePageUnsupportedTeamHubs = false,
    excludeGit = false,
    retainConnectionId
  } = options;
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [primaryProviderId, setPrimaryProviderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Triggers a fresh IPC bootstrap without changing external dependencies.
   */
  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Stable serialization of caller-supplied refetch keys for the effect dependency list.
   */
  const extraEffectDepsKey = JSON.stringify(deps);

  /**
   * Fetches database connections, team hubs, the active database id, and optionally
   * admin capability scan results for collection provider filtering.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        return Promise.all([
          window.api.listStorageConnections(),
          window.api.listTeamHubs(),
          window.api.getActiveStorageId(),
          excludeSnippetUnsupportedTeamHubs ||
          excludeLiveServerUnsupportedTeamHubs ||
          excludeLivePageUnsupportedTeamHubs
            ? window.api.scanTeamHubSessions().catch((): undefined => undefined)
            : Promise.resolve(undefined)
        ]);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        const [connections, hubs, activeDatabaseId, scanResults] = result;
        const merged: ProviderOption[] = [
          ...connections.map((connection) => ({
            id: connection.id,
            name: connection.name,
            kind: 'database' as const,
            type: connection.type
          })),
          ...hubs
            .filter((hub) => hub.connected !== false)
            .map((hub) => ({
              id: hub.id,
              name: hub.name,
              kind: 'team-hub' as const
            }))
        ];
        let visibleProviders = merged;
        void excludeAdminTeamHubs;
        if (excludeSnippetUnsupportedTeamHubs) {
          visibleProviders = filterSnippetProviders(
            visibleProviders,
            snippetUnsupportedHubIdsFromScanResults(scanResults),
            retainConnectionId
          );
        }
        if (excludeLiveServerUnsupportedTeamHubs) {
          visibleProviders = filterSnippetProviders(
            visibleProviders,
            liveEntityUnsupportedHubIdsFromScanResults(scanResults, 'liveServers'),
            retainConnectionId
          );
        }
        if (excludeLivePageUnsupportedTeamHubs) {
          visibleProviders = filterSnippetProviders(
            visibleProviders,
            liveEntityUnsupportedHubIdsFromScanResults(scanResults, 'livePages'),
            retainConnectionId
          );
        }
        if (excludeGit) {
          visibleProviders = filterGitProviders(visibleProviders, retainConnectionId);
        }
        setProviders(visibleProviders);
        setPrimaryProviderId(resolvePrimaryProviderId(visibleProviders, activeDatabaseId));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [
    excludeAdminTeamHubs,
    excludeSnippetUnsupportedTeamHubs,
    excludeLiveServerUnsupportedTeamHubs,
    excludeLivePageUnsupportedTeamHubs,
    excludeGit,
    retainConnectionId,
    reloadToken,
    extraEffectDepsKey
  ]);

  /**
   * Reloads providers when storage connections are saved or deleted in settings.
   */
  useEffect(() => {
    return subscribeStorageConnectionsChanged(() => {
      reload();
    });
  }, [reload]);

  return { providers, primaryProviderId, loading, error, reload };
}

/**
 * Returns whether a connection id refers to a team hub provider.
 *
 * @param providers - Loaded provider options.
 * @param connectionId - Collection provider connection id.
 */
export function isTeamHubProvider(
  providers: ProviderOption[],
  connectionId: string | undefined
): boolean {
  if (!connectionId) return false;
  return providers.some((provider) => provider.id === connectionId && provider.kind === 'team-hub');
}

/**
 * Maps provider connection ids to {@link CollectionProviderKind} values for sidebar badges.
 *
 * @param providers - Loaded provider options.
 */
export function providerTypesById(
  providers: ProviderOption[]
): Record<string, CollectionProviderKind> {
  return Object.fromEntries(
    providers.map((provider) => [
      provider.id,
      provider.kind === 'team-hub' ? 'team-hub' : (provider.type ?? 'sqlite')
    ])
  );
}
