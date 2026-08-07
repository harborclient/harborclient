import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { TeamHubNotificationSettings } from '#/renderer/src/ui/Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/TeamHubNotificationSettings';
import { settingAnchorId } from '../settingAnchorId';

/**
 * Catalog group id for Team Hub notification preferences in General settings.
 */
export const TEAM_HUB_NOTIFICATIONS_SETTING_ID = 'general.teamHubNotifications' as const;

/**
 * Trailing General settings block for per-hub Team Hub notification levels.
 *
 * Preferences save immediately through the Team Hub API (not the settings draft).
 */
export function GeneralTeamHubNotificationsExtra(): JSX.Element {
  const { teamHubs, loading, error } = useTeamHubs();

  return (
    <section
      id={settingAnchorId(TEAM_HUB_NOTIFICATIONS_SETTING_ID)}
      tabIndex={-1}
      className="outline-none"
      aria-label="Team Hub notifications"
    >
      <SettingSectionHeading
        settingId={TEAM_HUB_NOTIFICATIONS_SETTING_ID}
        title="Team Hub notifications"
        description="Choose which collaboration notices each Team Hub delivers. Changes save immediately to that hub."
      />

      {loading ? (
        <p className="m-0 text-muted" role="status" aria-live="polite">
          Loading Team Hub connections…
        </p>
      ) : null}

      {!loading && error != null ? (
        <p className="m-0 text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && error == null && teamHubs.length === 0 ? (
        <p className="m-0 text-muted" role="status">
          No Team Hub connections configured.
        </p>
      ) : null}

      {!loading && error == null && teamHubs.length > 0 ? (
        <div className="flex flex-col gap-6">
          {teamHubs.map((hub) => {
            const hubName = hub.name.trim() || 'Team Hub';
            return (
              <div key={hub.id} className="flex flex-col gap-2">
                <h3 className="m-0 text-[18px] font-medium text-text">{hubName}</h3>
                <TeamHubNotificationSettings
                  hubId={hub.id}
                  ariaLabel={`${hubName} notification settings`}
                  showHeading={false}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
