import {
  AsyncListState,
  PageSidebar,
  SidebarLayout,
  type PageSidebarItem
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import {
  faArrowsRotate,
  faDatabase,
  faFingerprint,
  faTerminal,
  faUsers
} from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { TeamCollectionsView } from '#/renderer/src/ui/TeamHub/TeamCollectionsView';
import { TeamManageView } from '#/renderer/src/ui/TeamHub/TeamManageView';
import { TeamSnippetsView } from '#/renderer/src/ui/TeamHub/TeamSnippetsView';
import { TeamTokensView } from '#/renderer/src/ui/TeamHub/TeamTokensView';
import { getReloadConfigAlertMessage } from '#/renderer/src/ui/TeamHub/teamHubReloadHelpers';
import { formatIpcErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';

type TeamHubAdminSection = 'users' | 'tokens' | 'collections' | 'snippets';
type TeamHubAdminSidebarItem = TeamHubAdminSection | 'reload';

interface Props {
  /**
   * Configured team hub connection id to administer.
   */
  hubId: string;

  /**
   * Closes this team hub admin page tab.
   */
  onClose: () => void;
}

/**
 * Full-area team hub administration with sidebar navigation for users, tokens,
 * collections, and server config reload.
 */
export function TeamHubAdmin({ hubId, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { teamHubs, loading, error, reload } = useTeamHubs();
  const hub = teamHubs.find((entry) => entry.id === hubId) ?? null;
  const [section, setSection] = useState<TeamHubAdminSection>('users');
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  /**
   * Closes the tab when the backing hub connection was removed elsewhere.
   */
  useEffect(() => {
    if (loading || error != null) {
      return;
    }

    if (!hub) {
      onClose();
    }
  }, [loading, error, hub, onClose]);

  /**
   * Sidebar entries for team hub administration, including the reload action row.
   */
  const sidebarItems = useMemo((): PageSidebarItem<TeamHubAdminSidebarItem>[] => {
    return [
      { value: 'users', label: 'Manage users', icon: faUsers },
      { value: 'tokens', label: 'Manage tokens', icon: faFingerprint },
      { value: 'collections', label: 'Manage collections', icon: faDatabase },
      { value: 'snippets', label: 'Manage snippets', icon: faTerminal },
      {
        value: 'reload',
        label: reloading ? 'Reloading…' : 'Reload',
        icon: faArrowsRotate
      }
    ];
  }, [reloading]);

  /**
   * Switches admin sections or triggers a server config reload from the sidebar.
   *
   * @param value - Selected sidebar item id.
   */
  const handleSidebarSelect = (value: TeamHubAdminSidebarItem): void => {
    if (value === 'reload') {
      void handleReload();
      return;
    }

    setSection(value);
  };

  /**
   * Reloads reloadable config sections on the selected hub connection.
   */
  const handleReload = async (): Promise<void> => {
    if (reloading) {
      return;
    }

    setReloadError(null);
    setReloading(true);

    try {
      const result = await window.api.reloadTeamHubConfig(hubId);
      const alertMessage = getReloadConfigAlertMessage(result);
      if (alertMessage) {
        showAlert(dispatch, alertMessage, 'Config reload failed', { icon: 'warning' });
        return;
      }

      toast.success('Config reloaded.');
    } catch (err) {
      setReloadError(formatIpcErrorMessage(err, 'Failed to reload team hub config.'));
    } finally {
      setReloading(false);
    }
  };

  if (loading || !hub) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-6 pt-0!">
        <AsyncListState
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={false}
          emptyMessage=""
        >
          {null}
        </AsyncListState>
      </div>
    );
  }

  return (
    <SidebarLayout
      sidebar={
        <PageSidebar
          ariaLabel="Team hub admin sections"
          selected={section}
          onSelect={handleSidebarSelect}
          items={sidebarItems}
        />
      }
    >
      {reloadError ? (
        <p className="mb-4 text-[14px] text-danger" role="status">
          {reloadError}
        </p>
      ) : null}
      {section === 'users' ? (
        <TeamManageView hub={hub} />
      ) : section === 'tokens' ? (
        <TeamTokensView hub={hub} />
      ) : section === 'collections' ? (
        <TeamCollectionsView hub={hub} />
      ) : (
        <TeamSnippetsView hub={hub} />
      )}
    </SidebarLayout>
  );
}
