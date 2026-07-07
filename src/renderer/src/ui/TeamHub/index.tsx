import { type JSX } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import type { TeamHub } from '#/shared/types';
import { TeamHubList } from './TeamHubList';
import { teamHubDisplayName } from './teamHubDisplayName';

/**
 * Full-area team hub management with list, add, edit, and delete flows.
 */
export function TeamHub(): JSX.Element {
  const dispatch = useAppDispatch();
  const { teamHubs, loading, error: bootstrapError, reload, reloadToken } = useTeamHubs();
  const { serviceFlagsByHubId, adminHubIds, scanning } = useTeamHubServiceScan(
    teamHubs,
    reloadToken,
    !loading && bootstrapError == null
  );

  /**
   * Opens team hub administration in a dedicated page tab for the selected hub.
   *
   * @param hub - Admin team hub connection to manage.
   */
  const handleManage = (hub: TeamHub): void => {
    dispatch(
      openPageTab({
        type: 'team-hub-admin',
        hubId: hub.id,
        label: teamHubDisplayName(hub)
      })
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6 pt-0!">
        <TeamHubList
          teamHubs={teamHubs}
          loading={loading}
          bootstrapError={bootstrapError}
          reload={reload}
          adminHubIds={adminHubIds}
          serviceFlagsByHubId={serviceFlagsByHubId}
          scanning={scanning}
          onManage={handleManage}
        />
      </div>
    </div>
  );
}
