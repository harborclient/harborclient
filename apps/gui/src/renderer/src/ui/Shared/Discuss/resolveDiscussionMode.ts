/**
 * UI mode for entity-scoped notes and discussion panels.
 */
export type DiscussionMode = 'legacy-notes' | 'threaded';

/**
 * Inputs used to decide whether threaded Team Hub discussion is available.
 */
export interface ResolveDiscussionModeInput {
  /**
   * Collection provider connection id, when known.
   */
  connectionId: string | undefined;

  /**
   * Server-side entity UUID required for Team Hub discussion routes.
   */
  entityUuid: string | undefined;

  /**
   * When true, the connection id refers to a configured Team Hub.
   */
  isTeamHubConnection: boolean;

  /**
   * When true, the Team Hub connection is mounted and reachable.
   */
  hubConnected: boolean;

  /**
   * When true, the hub server exposes discussion routes.
   */
  communicationServiceEnabled: boolean;

  /**
   * When true, the authenticated token may call discussion routes.
   */
  communicationAccess: boolean;
}

/**
 * Chooses between legacy single-field notes and threaded Team Hub discussion.
 *
 * @param input - Connection, entity, and capability flags for the target resource.
 * @returns `threaded` when every Team Hub communication prerequisite is met.
 */
export function resolveDiscussionMode(input: ResolveDiscussionModeInput): DiscussionMode {
  if (!input.connectionId || !input.entityUuid) {
    return 'legacy-notes';
  }
  if (!input.isTeamHubConnection) {
    return 'legacy-notes';
  }
  if (!input.hubConnected) {
    return 'legacy-notes';
  }
  if (!input.communicationServiceEnabled) {
    return 'legacy-notes';
  }
  if (!input.communicationAccess) {
    return 'legacy-notes';
  }
  return 'threaded';
}
