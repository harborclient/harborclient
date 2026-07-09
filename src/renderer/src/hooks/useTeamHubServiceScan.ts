import { useCallback, useEffect, useState } from 'react';
import type { TeamHub, TeamHubServiceFlags } from '#/shared/types';

/**
 * Team hub service scan state for the hub list UI.
 */
export interface TeamHubServiceScanState {
  /**
   * Hub server service flags keyed by hub connection id.
   */
  serviceFlagsByHubId: Map<string, TeamHubServiceFlags>;

  /**
   * Hub ids whose tokens report management API capabilities.
   */
  adminHubIds: Set<string>;

  /**
   * True while a session scan is in flight.
   */
  scanning: boolean;

  /**
   * Re-runs the service scan for the current hub list.
   */
  rescanServices: () => void;
}

/**
 * Returns empty hub service flags with every service marked unavailable.
 */
function emptyServices(): TeamHubServiceFlags {
  return {
    storage: false,
    llm: false,
    openai: false,
    pluginCatalog: false,
    snippets: false,
    admin: false
  };
}

/**
 * Scans configured team hubs for server services and admin capabilities when the list is ready.
 *
 * @param teamHubs - Loaded team hub connections.
 * @param reloadToken - Counter that changes when the hub list is reloaded.
 * @param enabled - When false, skips scanning until the hub list has finished loading.
 * @returns Service flags, admin hub ids, scan-in-progress flag, and rescan callback.
 */
export function useTeamHubServiceScan(
  teamHubs: TeamHub[],
  reloadToken: number,
  enabled: boolean
): TeamHubServiceScanState {
  const [serviceFlagsByHubId, setServiceFlagsByHubId] = useState(
    () => new Map<string, TeamHubServiceFlags>()
  );
  const [adminHubIds, setAdminHubIds] = useState<Set<string>>(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [scanToken, setScanToken] = useState(0);
  const shouldScan = enabled && teamHubs.length > 0;

  /**
   * Triggers another service scan without reloading the hub list from IPC.
   */
  const rescanServices = useCallback((): void => {
    setScanToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!shouldScan) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setScanning(true);
        setServiceFlagsByHubId(new Map());
        setAdminHubIds(new Set());
        return window.api.scanTeamHubSessions();
      })
      .then((results) => {
        if (cancelled || results === undefined) return;

        const nextServiceFlags = new Map<string, TeamHubServiceFlags>();
        const nextAdminHubIds = new Set<string>();

        for (const result of results) {
          nextServiceFlags.set(result.hubId, result.services);
          if (result.managementApi) {
            nextAdminHubIds.add(result.hubId);
          }
        }

        for (const hub of teamHubs) {
          if (!nextServiceFlags.has(hub.id)) {
            nextServiceFlags.set(hub.id, emptyServices());
          }
        }

        setServiceFlagsByHubId(nextServiceFlags);
        setAdminHubIds(nextAdminHubIds);
        setScanning(false);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceFlagsByHubId(new Map(teamHubs.map((hub) => [hub.id, emptyServices()])));
        setAdminHubIds(new Set());
        setScanning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldScan, reloadToken, scanToken, teamHubs]);

  if (!shouldScan) {
    return {
      serviceFlagsByHubId: new Map(),
      adminHubIds: new Set(),
      scanning: false,
      rescanServices
    };
  }

  return { serviceFlagsByHubId, adminHubIds, scanning, rescanServices };
}
