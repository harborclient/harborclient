import { createContext, useContext } from 'react';
import type { CollectionProviderKind } from '#/shared/types';
import type { ProviderOption } from '#/renderer/src/hooks/useProviders';

/**
 * Shared provider metadata consumed by sidebar sections for badges and
 * team-hub-aware confirmations. Sourced from a single {@link useProviders}
 * call so sections do not each trigger a duplicate IPC bootstrap.
 */
export interface SidebarProvidersContextValue {
  /**
   * Loaded database connections and team hubs.
   */
  providers: ProviderOption[];

  /**
   * Default connection id used when a collection has no explicit connection.
   */
  primaryConnectionId: string;

  /**
   * Human-readable connection names keyed by connection id.
   */
  connectionNamesById: Record<string, string>;

  /**
   * Provider types keyed by connection id, for storage-location badges.
   */
  connectionTypesById: Record<string, CollectionProviderKind>;
}

/**
 * React context for shared sidebar provider metadata.
 */
export const SidebarProvidersContext = createContext<SidebarProvidersContextValue | null>(null);

/**
 * Returns shared sidebar provider metadata.
 *
 * @throws When called outside `SidebarProvidersProvider`.
 */
export function useSidebarProviders(): SidebarProvidersContextValue {
  const context = useContext(SidebarProvidersContext);
  if (!context) {
    throw new Error('useSidebarProviders must be used within SidebarProvidersProvider');
  }
  return context;
}
