import { useCallback, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { TeamHubRailAvatar } from './TeamHubRailAvatar';

interface Props {
  /**
   * Whether the sidebar rail shows labels beside icons.
   */
  expanded: boolean;
}

/**
 * Resolves the display name used for avatar initials.
 *
 * Prefers the live session user name from the latest scan, then the persisted
 * user name on the hub record, then the connection display name.
 *
 * @param hub - Configured team hub.
 * @param scanUserName - Authenticated user name from the latest session scan.
 */
function resolveAvatarDisplayName(hub: TeamHub, scanUserName: string | undefined): string {
  return scanUserName?.trim() || hub.userName?.trim() || hub.name.trim() || 'Team Hub';
}

/**
 * Team Hub connection avatars rendered in the sidebar rail footer.
 *
 * Each configured hub gets a square initials avatar. Clicking toggles soft
 * connect/disconnect; disconnecting asks for confirmation first. After a
 * successful toggle, collections and hub LLM models are refreshed so
 * hub-backed UI disappears or reappears immediately.
 *
 * @param props - Rail expanded state for avatar label density.
 */
export function TeamHubRailAvatars({ expanded }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { teamHubs, loading, error, reload, reloadToken } = useTeamHubs();
  const { serviceFlagsByHubId, userNameByHubId, rescanServices } = useTeamHubServiceScan(
    teamHubs,
    reloadToken,
    !loading && error == null
  );
  const [pendingHubId, setPendingHubId] = useState<string | null>(null);

  /**
   * Soft-connects or soft-disconnects a hub, then refreshes dependent UI.
   *
   * @param hub - Team hub whose connection state should toggle.
   */
  const handleToggle = useCallback(
    async (hub: TeamHub): Promise<void> => {
      if (pendingHubId != null) {
        return;
      }

      const currentlyConnected = hub.connected !== false;
      if (currentlyConnected) {
        const confirmed = await confirm({
          title: `Disconnect from "${hub.name || 'Team Hub'}"?`,
          message: 'Are you sure?',
          confirmLabel: 'Disconnect',
          variant: 'danger'
        });
        if (!confirmed) {
          return;
        }
      }

      setPendingHubId(hub.id);
      try {
        await window.api.setTeamHubConnected(hub.id, !currentlyConnected);
        reload();
        rescanServices();
        await dispatch(refreshCollections());
        void dispatch(refreshHubLlmModels());
        toast.success(
          currentlyConnected
            ? `Disconnected from ${hub.name || 'Team Hub'}.`
            : `Connected to ${hub.name || 'Team Hub'}.`
        );
      } catch (err: unknown) {
        showAlert(
          dispatch,
          err instanceof Error ? err.message : String(err),
          currentlyConnected ? 'Disconnect failed' : 'Connect failed'
        );
      } finally {
        setPendingHubId(null);
      }
    },
    [confirm, dispatch, pendingHubId, reload, rescanServices]
  );

  if (loading || error != null || teamHubs.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className="hc-team-hub-rail-avatars flex flex-col items-stretch"
        role="group"
        aria-label="Team Hub connections"
      >
        {teamHubs.map((hub) => {
          const connected = hub.connected !== false;
          const online = serviceFlagsByHubId.get(hub.id)?.storage ?? false;
          const displayName = resolveAvatarDisplayName(hub, userNameByHubId.get(hub.id));

          return (
            <TeamHubRailAvatar
              key={hub.id}
              hubId={hub.id}
              hubName={hub.name || 'Untitled'}
              displayName={displayName}
              connected={connected}
              online={online}
              expanded={expanded}
              onToggle={() => {
                void handleToggle(hub);
              }}
            />
          );
        })}
      </div>
      <div
        className="hc-sidebar-rail-separator h-px w-full shrink-0 bg-sidebar-rail-separator"
        aria-hidden
      />
    </>
  );
}
