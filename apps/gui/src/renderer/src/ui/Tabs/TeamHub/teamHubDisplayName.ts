import type { TeamHub } from '#/shared/types';

/**
 * Returns the display label for a configured team hub connection.
 *
 * @param hub - Team hub connection with optional name and base URL.
 * @returns Trimmed name, base URL, or "Untitled" when both are empty.
 */
export function teamHubDisplayName(hub: Pick<TeamHub, 'name' | 'baseUrl'>): string {
  return hub.name?.trim() || hub.baseUrl || 'Untitled';
}

/**
 * Resolves the tab label for a team hub admin page tab.
 *
 * Prefers the live hub record, then a snapshot stored when the tab opened,
 * then "Untitled" when neither is available.
 *
 * @param page - Team hub admin page reference with hub id and optional label snapshot.
 * @param teamHubs - Current configured team hubs from settings.
 * @returns Display name for the manage tab or close prompt.
 */
export function resolveTeamHubAdminTabLabel(
  page: { hubId: string; label?: string },
  teamHubs: TeamHub[]
): string {
  const hub = teamHubs.find((entry) => entry.id === page.hubId);
  if (hub) {
    return teamHubDisplayName(hub);
  }

  const snapshot = page.label?.trim();
  if (snapshot) {
    return snapshot;
  }

  return 'Untitled';
}
