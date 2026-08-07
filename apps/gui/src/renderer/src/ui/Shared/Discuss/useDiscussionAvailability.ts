import { useMemo } from 'react';
import type { TeamHubDiscussionTarget } from '@harborclient/core/types';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { resolveDiscussionMode, type DiscussionMode } from './resolveDiscussionMode';

/**
 * Resolved discussion availability for a Team Hub-backed entity.
 */
export interface DiscussionAvailability {
  /**
   * Whether the UI should render legacy notes or threaded discussion.
   */
  mode: DiscussionMode;

  /**
   * When true, the connected hub requires encrypted discussion bodies.
   */
  discussionE2ee: boolean;

  /**
   * When true, this device has active local keys and a matching server enrollment.
   */
  deviceEnrolled: boolean;

  /**
   * Team Hub connection id when threaded mode is active.
   */
  hubId: string | undefined;

  /**
   * Target descriptor passed to Team Hub discussion IPC methods.
   */
  target: TeamHubDiscussionTarget | undefined;

  /**
   * True while hub metadata needed for mode detection is loading.
   */
  loading: boolean;
}

/**
 * Detects whether an entity should use legacy notes or threaded Team Hub discussion.
 *
 * Mode resolution waits for the shared session scan so communication access and
 * E2EE flags are known before choosing between legacy notes and threaded UI —
 * avoiding a legacy→threaded flash when switching to the Discuss tab.
 *
 * @param connectionId - Collection provider connection id, when known.
 * @param target - Entity type and server UUID for discussion routes.
 * @returns Availability flags for the Discuss UI.
 */
export function useDiscussionAvailability(
  connectionId: string | undefined,
  target: TeamHubDiscussionTarget | undefined
): DiscussionAvailability {
  const { teamHubs, loading: hubsLoading, reloadToken } = useTeamHubs();
  const { serviceFlagsByHubId, discussionInfoByHubId, scanning } = useTeamHubServiceScan(
    teamHubs,
    reloadToken,
    !hubsLoading
  );

  return useMemo(() => {
    const loading = hubsLoading || scanning;
    const hub = connectionId ? teamHubs.find((entry) => entry.id === connectionId) : undefined;
    const discussionInfo = connectionId ? discussionInfoByHubId.get(connectionId) : undefined;
    const services = connectionId ? serviceFlagsByHubId.get(connectionId) : undefined;

    const mode = resolveDiscussionMode({
      connectionId,
      entityUuid: target?.entityId,
      isTeamHubConnection: hub != null,
      hubConnected: hub?.connected !== false,
      communicationServiceEnabled: services?.communication === true,
      communicationAccess: discussionInfo?.communicationAccess === true
    });

    return {
      mode,
      discussionE2ee: discussionInfo?.discussionE2ee === true,
      deviceEnrolled: discussionInfo?.deviceEnrolled === true,
      hubId: mode === 'threaded' ? connectionId : undefined,
      target: mode === 'threaded' && target ? target : undefined,
      loading
    };
  }, [
    connectionId,
    target,
    teamHubs,
    hubsLoading,
    scanning,
    serviceFlagsByHubId,
    discussionInfoByHubId
  ]);
}
