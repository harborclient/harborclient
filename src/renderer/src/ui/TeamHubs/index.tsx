import { useMemo, useState, type JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { useTeamHubAdminScan } from '#/renderer/src/hooks/useTeamHubAdminScan';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { TeamHubList } from './TeamHubList';
import { TeamManageView } from './TeamManageView';
import { TeamTokensView } from './TeamTokensView';

type TeamHubsView = 'list' | 'manageUsers' | 'manageTokens';

interface Props {
  /**
   * Closes the team hubs view.
   */
  onClose: () => void;
}

/**
 * Full-area team hub management with list, add, edit, delete, and team admin flows.
 */
export function TeamHubs({ onClose }: Props): JSX.Element {
  const [view, setView] = useState<TeamHubsView>('list');
  const { teamHubs, loading, error: bootstrapError, reload, reloadToken } = useTeamHubs();
  const { adminHubIds, scanning } = useTeamHubAdminScan(
    teamHubs,
    reloadToken,
    !loading && bootstrapError == null
  );
  const adminHubs = useMemo(
    () => teamHubs.filter((hub) => adminHubIds.has(hub.id)),
    [adminHubIds, teamHubs]
  );
  const showManageTeam = !scanning && adminHubIds.size > 0;

  const title =
    view === 'list' ? 'Team Hubs' : view === 'manageUsers' ? 'Manage users' : 'Manage tokens';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">{title}</h1>
        <Button
          type="button"
          variant="icon"
          className="opacity-100 text-[28px]"
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {view === 'list' ? (
          <TeamHubList
            teamHubs={teamHubs}
            loading={loading}
            bootstrapError={bootstrapError}
            reload={reload}
            showManageTeam={showManageTeam}
            adminHubIds={adminHubIds}
            scanning={scanning}
            onManageUsers={() => setView('manageUsers')}
            onManageTokens={() => setView('manageTokens')}
          />
        ) : view === 'manageUsers' ? (
          <TeamManageView adminHubs={adminHubs} onBack={() => setView('list')} />
        ) : (
          <TeamTokensView adminHubs={adminHubs} onBack={() => setView('list')} />
        )}
      </div>
    </div>
  );
}
