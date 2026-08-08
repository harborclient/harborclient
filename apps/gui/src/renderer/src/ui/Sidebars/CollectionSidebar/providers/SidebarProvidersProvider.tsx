import { useEffect, useMemo, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { providerTypesById, useProviders } from '#/renderer/src/hooks/useProviders';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import {
  SidebarProvidersContext,
  type SidebarProvidersContextValue
} from './sidebarProvidersContext';

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
  const { teamHubs } = useTeamHubs();

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
  const connectionNamesById = useMemo(() => {
    const names = Object.fromEntries(
      providers.map((provider) => [provider.id, provider.name || 'Untitled'])
    );
    for (const hub of teamHubs) {
      names[hub.id] = hub.name || 'Untitled';
    }
    return names;
  }, [providers, teamHubs]);

  /**
   * Maps connection ids to provider types for sidebar badges.
   */
  const connectionTypesById = useMemo(() => {
    const types = providerTypesById(providers);
    for (const hub of teamHubs) {
      types[hub.id] = 'team-hub';
    }
    return types;
  }, [providers, teamHubs]);

  /**
   * Maps team hub ids to soft-connection flags for dimmed sidebar collections.
   */
  const teamHubConnectedById = useMemo(
    () => Object.fromEntries(teamHubs.map((hub) => [hub.id, hub.connected !== false])),
    [teamHubs]
  );

  const value = useMemo<SidebarProvidersContextValue>(
    () => ({
      providers,
      primaryConnectionId: primaryProviderId,
      connectionNamesById,
      connectionTypesById,
      teamHubConnectedById
    }),
    [providers, primaryProviderId, connectionNamesById, connectionTypesById, teamHubConnectedById]
  );

  return (
    <SidebarProvidersContext.Provider value={value}>{children}</SidebarProvidersContext.Provider>
  );
}
