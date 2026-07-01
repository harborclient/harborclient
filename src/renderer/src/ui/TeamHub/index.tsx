import { useState, type JSX } from 'react';
import type { TeamHub } from '#/shared/types';
import { useEscapeBack, useEscapeBackCapture } from '#/renderer/src/hooks/useEscapeBack';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { TeamCollectionsView } from './TeamCollectionsView';
import { TeamHubList } from './TeamHubList';
import { TeamManageView } from './TeamManageView';
import { TeamTokensView } from './TeamTokensView';

type TeamHubView = 'list' | 'manageUsers' | 'manageTokens' | 'manageCollections';

interface Props {
  /**
   * Closes the team hub view.
   */
  onClose: () => void;
}

/**
 * Full-area team hub management with list, add, edit, delete, and team admin flows.
 */
export function TeamHub({ onClose }: Props): JSX.Element {
  const [view, setView] = useState<TeamHubView>('list');
  const [activeAdminHub, setActiveAdminHub] = useState<TeamHub | null>(null);
  const { teamHubs, loading, error: bootstrapError, reload, reloadToken } = useTeamHubs();
  const { serviceFlagsByHubId, adminHubIds, scanning, rescanServices } = useTeamHubServiceScan(
    teamHubs,
    reloadToken,
    !loading && bootstrapError == null
  );

  /**
   * Returns to the hub list and clears the active admin connection.
   */
  const handleBackToList = (): void => {
    setActiveAdminHub(null);
    setView('list');
  };

  /**
   * Opens user management for the selected admin hub connection.
   *
   * @param hub - Admin team hub connection to manage.
   */
  const handleManageUsers = (hub: TeamHub): void => {
    setActiveAdminHub(hub);
    setView('manageUsers');
  };

  /**
   * Opens token management for the selected admin hub connection.
   *
   * @param hub - Admin team hub connection to manage.
   */
  const handleManageTokens = (hub: TeamHub): void => {
    setActiveAdminHub(hub);
    setView('manageTokens');
  };

  /**
   * Opens collection management for the selected admin hub connection.
   *
   * @param hub - Admin team hub connection to manage.
   */
  const handleManageCollections = (hub: TeamHub): void => {
    setActiveAdminHub(hub);
    setView('manageCollections');
  };

  /**
   * Returns to the request editor when the hub list is showing.
   */
  useEscapeBack(onClose, view === 'list');

  /**
   * Returns to the hub list from user or token admin views on Escape.
   */
  useEscapeBackCapture(handleBackToList, view === 'manageUsers' || view === 'manageTokens');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6 pt-0!">
        {view === 'list' ? (
          <TeamHubList
            teamHubs={teamHubs}
            loading={loading}
            bootstrapError={bootstrapError}
            reload={reload}
            adminHubIds={adminHubIds}
            serviceFlagsByHubId={serviceFlagsByHubId}
            scanning={scanning}
            onRescanServices={rescanServices}
            onManageUsers={handleManageUsers}
            onManageTokens={handleManageTokens}
            onManageCollections={handleManageCollections}
            onClose={onClose}
          />
        ) : view === 'manageUsers' && activeAdminHub ? (
          <TeamManageView hub={activeAdminHub} onBack={handleBackToList} />
        ) : view === 'manageTokens' && activeAdminHub ? (
          <TeamTokensView hub={activeAdminHub} onBack={handleBackToList} />
        ) : view === 'manageCollections' && activeAdminHub ? (
          <TeamCollectionsView hub={activeAdminHub} onBack={handleBackToList} />
        ) : null}
      </div>
    </div>
  );
}
