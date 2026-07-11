import { useEffect, useMemo, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { providerTypesById, useProviders } from '#/renderer/src/hooks/useProviders';
import {
  SidebarProvidersContext,
  type SidebarProvidersContextValue
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarProvidersContext';

interface ProviderProps {
  /**
   * Sidebar subtree that reads provider metadata.
   */
  children: ReactNode;
}

/**
 * Loads collection providers once and exposes derived lookup maps to the
 * sidebar tree. Surfaces a one-time toast when the bootstrap fails so missing
 * badges do not fail silently.
 */
export function SidebarProvidersProvider({ children }: ProviderProps): JSX.Element {
  const { providers, primaryProviderId, error } = useProviders();

  /**
   * Surfaces provider bootstrap failures so badges may be missing without
   * silent failure.
   */
  useEffect(() => {
    if (error) {
      toast.error(`Failed to load providers: ${error}`);
    }
  }, [error]);

  /**
   * Maps connection ids to display names for sidebar badges.
   */
  const connectionNamesById = useMemo(
    () =>
      Object.fromEntries(providers.map((provider) => [provider.id, provider.name || 'Untitled'])),
    [providers]
  );

  /**
   * Maps connection ids to provider types for sidebar badges.
   */
  const connectionTypesById = useMemo(() => providerTypesById(providers), [providers]);

  const value = useMemo<SidebarProvidersContextValue>(
    () => ({
      providers,
      primaryConnectionId: primaryProviderId,
      connectionNamesById,
      connectionTypesById
    }),
    [providers, primaryProviderId, connectionNamesById, connectionTypesById]
  );

  return (
    <SidebarProvidersContext.Provider value={value}>{children}</SidebarProvidersContext.Provider>
  );
}
