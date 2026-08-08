import { useCallback, useEffect, useState } from 'react';
import type { TeamHub, TeamHubAvatar, TeamHubServiceFlags } from '@harborclient/core/types';

/**
 * Monotonic counter bumped whenever any caller requests a global service rescan.
 */
let globalServiceScanToken = 0;

/**
 * Listeners registered by active {@link useTeamHubServiceScan} hook instances.
 */
const globalServiceScanListeners = new Set<() => void>();

/**
 * Requests a Team Hub service scan from every active {@link useTeamHubServiceScan}
 * instance (for example the sidebar rail and an open admin settings tab).
 */
export function requestTeamHubServiceRescan(): void {
  globalServiceScanToken += 1;
  for (const listener of globalServiceScanListeners) {
    listener();
  }
}

/**
 * Clears global rescan listeners. Used in tests.
 */
export function clearTeamHubServiceScanListeners(): void {
  globalServiceScanListeners.clear();
  globalServiceScanToken = 0;
}

/**
 * Subscribes to global Team Hub service rescan requests.
 *
 * @param listener - Called whenever {@link requestTeamHubServiceRescan} runs.
 * @returns Unsubscribe function.
 */
export function subscribeTeamHubServiceRescan(listener: () => void): () => void {
  globalServiceScanListeners.add(listener);
  return () => {
    globalServiceScanListeners.delete(listener);
  };
}

/**
 * Authenticated session user fields derived from a Team Hub session scan.
 */
export interface TeamHubSessionUserInfo {
  /**
   * Stable Team Hub user account identifier.
   */
  id: string;

  /**
   * Display name for the authenticated account.
   */
  name: string;

  /**
   * Account role determining API capabilities.
   */
  role: 'admin' | 'user';

  /**
   * Persisted avatar initials when the hub supports user avatars.
   */
  avatarInitials?: string;

  /**
   * Persisted avatar color key when the hub supports user avatars.
   */
  avatarColor?: string;

  /**
   * Relative avatar image URL when the user has uploaded a picture.
   */
  avatarImageUrl?: string;
}

/**
 * Discussion-related session fields derived from a Team Hub session scan.
 */
export interface TeamHubDiscussionScanInfo {
  /**
   * When true, the authenticated token may call discussion routes on this hub.
   */
  communicationAccess: boolean;

  /**
   * When true, the hub requires encrypted discussion comment bodies.
   */
  discussionE2ee: boolean;

  /**
   * When true, this device has active local keys and a matching server enrollment.
   */
  deviceEnrolled: boolean;
}

/**
 * Team hub service scan state for the hub list UI.
 */
export interface TeamHubServiceScanState {
  /**
   * Hub server service flags keyed by hub connection id.
   */
  serviceFlagsByHubId: Map<string, TeamHubServiceFlags>;

  /**
   * Authenticated user display names keyed by hub connection id when the scan
   * succeeded.
   */
  userNameByHubId: Map<string, string>;

  /**
   * Authenticated session users keyed by hub connection id when the scan
   * succeeded.
   */
  sessionUserByHubId: Map<string, TeamHubSessionUserInfo>;

  /**
   * Server-provided hub avatar metadata keyed by hub connection id.
   */
  hubAvatarByHubId: Map<string, TeamHubAvatar>;

  /**
   * Discussion access and E2EE enrollment flags keyed by hub connection id.
   */
  discussionInfoByHubId: Map<string, TeamHubDiscussionScanInfo>;

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
    communication: false,
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
  const [userNameByHubId, setUserNameByHubId] = useState(() => new Map<string, string>());
  const [sessionUserByHubId, setSessionUserByHubId] = useState(
    () => new Map<string, TeamHubSessionUserInfo>()
  );
  const [hubAvatarByHubId, setHubAvatarByHubId] = useState(() => new Map<string, TeamHubAvatar>());
  const [discussionInfoByHubId, setDiscussionInfoByHubId] = useState(
    () => new Map<string, TeamHubDiscussionScanInfo>()
  );
  const [adminHubIds, setAdminHubIds] = useState<Set<string>>(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [globalScanToken, setGlobalScanToken] = useState(globalServiceScanToken);
  const shouldScan = enabled && teamHubs.length > 0;
  const scanPending = shouldScan && teamHubs.some((hub) => !serviceFlagsByHubId.has(hub.id));

  /**
   * Mirrors {@link globalServiceScanToken} into hook state so every mounted instance
   * re-scans when another part of the UI requests a refresh.
   */
  useEffect(
    () =>
      subscribeTeamHubServiceRescan(() => {
        setGlobalScanToken(globalServiceScanToken);
      }),
    []
  );

  /**
   * Triggers another service scan without reloading the hub list from IPC.
   */
  const rescanServices = useCallback((): void => {
    requestTeamHubServiceRescan();
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
        setUserNameByHubId(new Map());
        setSessionUserByHubId(new Map());
        setHubAvatarByHubId(new Map());
        setDiscussionInfoByHubId(new Map());
        setAdminHubIds(new Set());
        return window.api.scanTeamHubSessions();
      })
      .then((results) => {
        if (cancelled || results === undefined) return;

        const nextServiceFlags = new Map<string, TeamHubServiceFlags>();
        const nextUserNames = new Map<string, string>();
        const nextSessionUsers = new Map<string, TeamHubSessionUserInfo>();
        const nextHubAvatars = new Map<string, TeamHubAvatar>();
        const nextDiscussionInfo = new Map<string, TeamHubDiscussionScanInfo>();
        const nextAdminHubIds = new Set<string>();

        for (const result of results) {
          nextServiceFlags.set(result.hubId, result.services);
          nextDiscussionInfo.set(result.hubId, {
            communicationAccess: result.communicationAccess === true,
            discussionE2ee: result.discussionE2ee === true,
            deviceEnrolled: result.deviceEnrolled === true
          });
          if (result.user?.name) {
            nextUserNames.set(result.hubId, result.user.name);
          }
          if (result.user) {
            nextSessionUsers.set(result.hubId, {
              id: result.user.id,
              name: result.user.name,
              role: result.user.role,
              ...(result.user.avatarInitials ? { avatarInitials: result.user.avatarInitials } : {}),
              ...(result.user.avatarColor ? { avatarColor: result.user.avatarColor } : {}),
              ...(result.user.avatarImageUrl ? { avatarImageUrl: result.user.avatarImageUrl } : {})
            });
          }
          if (result.hubAvatar) {
            nextHubAvatars.set(result.hubId, result.hubAvatar);
          }
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
        setUserNameByHubId(nextUserNames);
        setSessionUserByHubId(nextSessionUsers);
        setHubAvatarByHubId(nextHubAvatars);
        setDiscussionInfoByHubId(nextDiscussionInfo);
        setAdminHubIds(nextAdminHubIds);
        setScanning(false);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceFlagsByHubId(new Map(teamHubs.map((hub) => [hub.id, emptyServices()])));
        setUserNameByHubId(new Map());
        setSessionUserByHubId(new Map());
        setHubAvatarByHubId(new Map());
        setDiscussionInfoByHubId(new Map());
        setAdminHubIds(new Set());
        setScanning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldScan, reloadToken, globalScanToken, teamHubs]);

  if (!shouldScan) {
    return {
      serviceFlagsByHubId: new Map(),
      userNameByHubId: new Map(),
      sessionUserByHubId: new Map(),
      hubAvatarByHubId: new Map(),
      discussionInfoByHubId: new Map(),
      adminHubIds: new Set(),
      scanning: false,
      rescanServices
    };
  }

  return {
    serviceFlagsByHubId,
    userNameByHubId,
    sessionUserByHubId,
    hubAvatarByHubId,
    discussionInfoByHubId,
    adminHubIds,
    scanning: scanning || scanPending,
    rescanServices
  };
}
