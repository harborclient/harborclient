import {
  AsyncListState,
  PageSidebar,
  SidebarLayout,
  type PageSidebarItem
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import {
  faArrowsRotate,
  faClockRotateLeft,
  faDatabase,
  faFingerprint,
  faCode,
  faGear,
  faLock,
  faUsers
} from '#/renderer/src/fontawesome';
import { TeamCollectionsView } from '#/renderer/src/ui/Tabs/TeamHub/TeamCollectionsView';
import { TeamDevicesView } from '#/renderer/src/ui/Tabs/TeamHub/TeamDevicesView';
import { TeamGeneralView } from '#/renderer/src/ui/Tabs/TeamHub/TeamGeneralView';
import { TeamManageView } from '#/renderer/src/ui/Tabs/TeamHub/TeamManageView';
import { TeamReloadView } from '#/renderer/src/ui/Tabs/TeamHub/TeamReloadView';
import { TeamRunResultsView } from '#/renderer/src/ui/Tabs/TeamHub/TeamRunResultsView';
import { TeamSnippetsView } from '#/renderer/src/ui/Tabs/TeamHub/TeamSnippetsView';
import { TeamTokensView } from '#/renderer/src/ui/Tabs/TeamHub/TeamTokensView';

type TeamHubAdminSection =
  | 'general'
  | 'users'
  | 'tokens'
  | 'devices'
  | 'collections'
  | 'snippets'
  | 'run-results'
  | 'reload';

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
 * Full-area team hub administration with sidebar navigation for general settings,
 * users, tokens, collections, and server config reload.
 */
export function TeamHubAdmin({ hubId, onClose }: Props): JSX.Element {
  const { teamHubs, loading, error, reload } = useTeamHubs();
  const hub = teamHubs.find((entry) => entry.id === hubId) ?? null;
  const [section, setSection] = useState<TeamHubAdminSection>('general');

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
   * Sidebar entries for team hub administration, including the reload panel.
   */
  const sidebarItems = useMemo((): PageSidebarItem<TeamHubAdminSection>[] => {
    return [
      { value: 'general', label: 'General', icon: faGear },
      { value: 'users', label: 'Users', icon: faUsers },
      { value: 'tokens', label: 'Tokens', icon: faFingerprint },
      { value: 'devices', label: 'Devices', icon: faLock },
      { value: 'collections', label: 'Collections', icon: faDatabase },
      { value: 'snippets', label: 'Snippets', icon: faCode },
      { value: 'run-results', label: 'Run results', icon: faClockRotateLeft },
      { value: 'reload', label: 'Reload', icon: faArrowsRotate }
    ];
  }, []);

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
          onSelect={setSection}
          items={sidebarItems}
        />
      }
    >
      {section === 'general' ? (
        <TeamGeneralView key={hub.id} hub={hub} />
      ) : section === 'users' ? (
        <TeamManageView hub={hub} />
      ) : section === 'tokens' ? (
        <TeamTokensView hub={hub} />
      ) : section === 'devices' ? (
        <TeamDevicesView hub={hub} />
      ) : section === 'collections' ? (
        <TeamCollectionsView hub={hub} />
      ) : section === 'snippets' ? (
        <TeamSnippetsView hub={hub} />
      ) : section === 'run-results' ? (
        <TeamRunResultsView hub={hub} />
      ) : (
        <TeamReloadView hub={hub} />
      )}
    </SidebarLayout>
  );
}
