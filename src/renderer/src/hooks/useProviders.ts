import { useCallback, useEffect, useState } from 'react';
import type { CollectionProviderKind, StorageProvider } from '#/shared/types';

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
 * Loads database connections and team hubs via IPC and merges them into one provider list.
 *
 * @param deps - Optional effect dependencies; when they change the hook refetches.
 * @returns Provider list, primary id, loading/error flags, and a reload callback.
 */
export function useProviders(deps: readonly unknown[] = []): ProvidersState {
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
   * Fetches database connections, team hubs, and the active database id.
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
          window.api.getActiveStorageId()
        ]);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        const [connections, hubs, activeDatabaseId] = result;
        const merged: ProviderOption[] = [
          ...connections.map((connection) => ({
            id: connection.id,
            name: connection.name,
            kind: 'database' as const,
            type: connection.type
          })),
          ...hubs.map((hub) => ({
            id: hub.id,
            name: hub.name,
            kind: 'team-hub' as const
          }))
        ];
        setProviders(merged);
        const activeProvider =
          merged.find((provider) => provider.id === activeDatabaseId)?.id ??
          merged.find((provider) => provider.kind === 'database')?.id ??
          merged[0]?.id ??
          '';
        setPrimaryProviderId(activeProvider);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies intentional refetch keys
  }, [reloadToken, ...deps]);

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
