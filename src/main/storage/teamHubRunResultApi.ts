import type { CollectionRunnerSummary, RunResultsExportKind } from '#/shared/collectionRunner';

/**
 * Run result list row returned by Team Hub `GET /run-results`.
 *
 * Declared locally until {@link @harborclient/team-hub-api} 0.3.0 is adopted.
 */
export interface TeamHubRunResultRecord {
  /**
   * Stable run result UUID used in deep links.
   */
  id: string;

  /**
   * Whether the snapshot is a collection-wide or single-request run.
   */
  kind: RunResultsExportKind;

  /**
   * User-facing label for list rows.
   */
  label: string;

  /**
   * Collection display name captured at save time.
   */
  collectionName: string | null;

  /**
   * Request display name when the run targeted one request.
   */
  requestName: string | null;

  /**
   * Pass/fail/skip counts derived from the saved result rows.
   */
  summary: CollectionRunnerSummary;

  /**
   * ISO timestamp when the run result was saved.
   */
  createdAt: string;

  /**
   * User who saved the run result, when known.
   */
  createdByUserId?: string | null;
}

/**
 * Full run result returned by Team Hub detail and create routes.
 */
export interface TeamHubRunResultDetail extends TeamHubRunResultRecord {
  /**
   * Complete run-results export JSON stored with the snapshot.
   */
  payload: Record<string, unknown>;
}

/**
 * Request body for Team Hub `POST /run-results`.
 */
export interface TeamHubCreateRunResultInput {
  /**
   * Optional display label; generated on the server when omitted.
   */
  label?: string;

  /**
   * HarborClient run-results export payload to persist.
   */
  payload: Record<string, unknown>;
}

/**
 * Subset of {@link TeamHubClient} routes used to persist run result snapshots.
 */
export interface TeamHubRunResultClient {
  /**
   * Lists run results created by the authenticated token's own user.
   */
  listRunResults(): Promise<TeamHubRunResultRecord[]>;

  /**
   * Creates a new run result snapshot on the server.
   */
  createRunResult(input: TeamHubCreateRunResultInput): Promise<TeamHubRunResultDetail>;

  /**
   * Loads a run result snapshot by UUID.
   */
  getRunResult(id: string): Promise<TeamHubRunResultDetail>;

  /**
   * Deletes a run result snapshot created by the authenticated token's own user.
   */
  deleteRunResult(id: string): Promise<void>;

  /**
   * Lists every run result on the hub regardless of creator, for operator tokens.
   */
  listAdminRunResults(): Promise<TeamHubRunResultRecord[]>;

  /**
   * Deletes a run result regardless of creator, for operator tokens.
   */
  deleteAdminRunResult(id: string): Promise<void>;
}

/**
 * Casts a Team Hub HTTP client to the run-result API surface.
 *
 * @param client - Configured Team Hub client instance.
 * @returns Client narrowed to run-result routes.
 */
export function asTeamHubRunResultClient(client: unknown): TeamHubRunResultClient {
  return client as TeamHubRunResultClient;
}
