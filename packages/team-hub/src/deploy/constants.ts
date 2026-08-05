/**
 * Default GHCR image repository for production Team Hub containers (lowercase).
 */
export const DEFAULT_GHCR_IMAGE = 'ghcr.io/harborclient/team-hub';

/**
 * Default deployment directory name under the platform config root.
 */
export const DEPLOY_DIR_NAME = 'team-hub';

/**
 * Compose project service name used in the production template.
 */
export const COMPOSE_SERVICE_NAME = 'team-hub';

/**
 * Named Docker volume for bundled Postgres data in the production template.
 */
export const POSTGRES_VOLUME_NAME = 'team-hub-pgdata';

/**
 * Environment variable that overrides the managed deployment directory.
 */
export const DEPLOY_DIR_ENV_VAR = 'TEAM_HUB_DEPLOY_DIR';

/**
 * Environment variable that overrides the GHCR image reference (repository only, no tag).
 */
export const GHCR_IMAGE_ENV_VAR = 'TEAM_HUB_GHCR_IMAGE';
