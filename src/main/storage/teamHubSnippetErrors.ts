import type { MountedBackend } from '#/main/storage/routingInternals';
import {
  isTeamHubSnippetsForbiddenError,
  isTeamHubSnippetsUnsupportedError,
  TeamHubClientError
} from '@harborclient/team-hub-api';

/**
 * Returns a display label for a team hub provider used in snippet error messages.
 *
 * @param backend - Mounted team hub backend.
 */
function formatTeamHubSnippetTarget(backend: MountedBackend): string {
  const urlSuffix = backend.teamHubBaseUrl ? ` at ${backend.teamHubBaseUrl}` : '';
  return `"${backend.connectionName}" (Team Hub${urlSuffix})`;
}

/**
 * Translates Team Hub snippet create/move failures into user-facing errors.
 *
 * Non-team-hub backends rethrow the original error unchanged.
 *
 * @param backend - Destination provider backend.
 * @param err - Error thrown while creating a snippet on the destination.
 * @throws A descriptive Error for team hub failures; otherwise rethrows `err`.
 */
export function rethrowTeamHubSnippetCreateError(backend: MountedBackend, err: unknown): never {
  if (backend.connectionType !== 'team-hub') {
    throw err;
  }

  const target = formatTeamHubSnippetTarget(backend);

  if (isTeamHubSnippetsUnsupportedError(err)) {
    throw new Error(
      `${target} does not respond to snippet storage routes. Confirm the Team Hub base URL in settings matches the running server and that the server includes snippet support.`
    );
  }

  if (isTeamHubSnippetsForbiddenError(err)) {
    throw new Error(
      `${target} rejected snippet creation. The hub token needs snippet create access (snippetAccess: ["*"]) on the user account.`
    );
  }

  if (err instanceof TeamHubClientError) {
    throw new Error(`${target} snippet create failed: ${err.message}`);
  }

  throw err;
}
