import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildUserAvatarFieldsForCreate } from '#/avatar/userAvatarService.js';
import { defaultAvatarPresentation } from '#/avatar/avatarPresentation.js';
import { mapApiTokenSqlRow, type ApiTokenSqlRow } from '#/db/apiTokenRows.js';
import {
  DEVICE_KEY_SELECT_COLUMNS,
  mapDeviceKeySqlRow,
  type DeviceKeySqlRow
} from '#/db/deviceKeyRows.js';
import {
  buildDiscussionMlsCommitListResult,
  buildDiscussionMlsGroupStateRecord,
  normalizeDiscussionMlsCommitListLimit,
  parseDiscussionMlsCommitListCursor
} from '#/db/discussionMlsLogic.js';
import {
  DISCUSSION_MLS_COMMIT_SELECT_COLUMNS,
  DISCUSSION_MLS_GROUP_STATE_SELECT_COLUMNS,
  DISCUSSION_MLS_WELCOME_SELECT_COLUMNS,
  mapDiscussionMlsCommitSqlRow,
  mapDiscussionMlsGroupStateSqlRow,
  mapDiscussionMlsWelcomeSqlRow,
  type DiscussionMlsCommitSqlRow,
  type DiscussionMlsGroupStateSqlRow,
  type DiscussionMlsWelcomeSqlRow
} from '#/db/discussionMlsRows.js';
import { InvitationUnavailableError } from '#/db/invitationErrors.js';
import { mapInvitationSqlRow, type InvitationSqlRow } from '#/db/invitationRows.js';
import { INVITATION_SELECT, INVITATION_SELECT_COLUMNS } from '#/db/postgres/invitationSql.js';
import { generateApiToken } from '#/server/auth/apiTokens.js';
import { resolveActingUserName } from '#/db/attribution.js';
import {
  mapAuditLogSqlRow,
  serializeAuditMetadata,
  type AuditLogSqlRow
} from '#/db/auditLogRows.js';
import { BOOTSTRAP_USER_NAME } from '#/db/bootstrapUsers.js';
import { DEFAULT_TENANT_ID } from '#/config/multitenancyConfig.js';
import {
  mapCollectionSqlRow,
  mapDocumentSqlRow,
  mapEnvironmentSqlRow,
  mapFolderSqlRow,
  mapLivePageSqlRow,
  mapLiveServerSqlRow,
  mapRequestSqlRow,
  mapRunResultSqlRow,
  mapSnippetSqlRow,
  type CollectionSqlRow,
  type DocumentSqlRow,
  type EnvironmentSqlRow,
  type FolderSqlRow,
  type PayloadEntitySqlRow,
  type RequestSqlRow,
  type RunResultSqlRow,
  type SnippetSqlRow
} from '#/db/entityRows.js';
import { buildDefaultRunResultLabel, parseRunResultPayload } from '#/db/runResultPayload.js';
import {
  buildDiscussionListResult,
  normalizeDiscussionListLimit,
  normalizeDiscussionUpdateInput,
  parseDiscussionListCursor,
  prepareSqlDiscussionCommentInsert,
  assertDiscussionCommentEditable
} from '#/db/discussionCommentSql.js';
import {
  buildNoticeListResult,
  normalizeNoticeListLimit,
  parseNoticeListCursor
} from '#/db/noticeSql.js';
import {
  mapNoticeSqlRow,
  NOTICE_SELECT_COLUMNS,
  serializeNoticeDisplayMetadata,
  type NoticeSqlRow
} from '#/db/noticeRows.js';
import {
  DISCUSSION_COMMENT_SELECT_COLUMNS,
  mapDiscussionCommentSqlRow,
  serializeDiscussionBodyMetadata,
  type DiscussionCommentSqlRow
} from '#/db/discussionCommentRows.js';
import { DiscussionCommentNotFoundError } from '#/db/discussionCommentErrors.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { DbPoolStats } from '#/db/poolStats.js';
import { POSTGRES_MIGRATIONS } from '#/db/postgres/migrations.js';
import { postgresConfigSchema } from '#/db/postgres/schemas.js';
import type { PostgresDatabaseConfig } from '#/db/postgres/types.js';
import { createSystemUserInput, SYSTEM_USER_NAME } from '#/db/systemUsers.js';
import { trimRequiredName } from '#/db/trimRequiredName.js';
import { serializeSidebarMarker } from '#/db/sidebarMarker.js';
import { assertUserNameAvailable, assertUserNameNotReserved } from '#/db/userNameValidation.js';
import {
  API_TOKEN_SELECT_COLUMNS,
  AUDIT_LOG_SELECT_COLUMNS,
  COLLECTION_SELECT_COLUMNS,
  DOCUMENT_SELECT_COLUMNS,
  ENVIRONMENT_SELECT_COLUMNS,
  FOLDER_SELECT_COLUMNS,
  mapUserSqlRow,
  REQUEST_SELECT_COLUMNS,
  SNIPPET_SELECT_COLUMNS,
  serializeAccessList,
  USER_SELECT_COLUMNS,
  type UserSqlRow
} from '#/db/userRows.js';
import {
  LLM_USAGE_LOG_SELECT_COLUMNS,
  mapLlmUsageLogSqlRow,
  type LlmUsageLogSqlRow
} from '#/db/llmUsageLogRows.js';
import {
  LLM_USAGE_SELECT_COLUMNS,
  mapLlmUsageSqlRow,
  type LlmUsageSqlRow
} from '#/db/llmUsageRows.js';
import type {
  ApiTokenRecord,
  DeviceKeyRecord,
  AuditAction,
  AuditEntityType,
  AuditLogRecord,
  AuthConfig,
  CollectionRecord,
  CreateUserInput,
  CreatedInvitedUserResult,
  CreateLlmUsageLogInput,
  CreateRunResultInput,
  CreateLivePageRecordInput,
  CreateLiveServerRecordInput,
  EnvironmentRecord,
  FolderRecord,
  InvitationRecord,
  KeyValue,
  ListAuditLogOptions,
  LivePageRecord,
  LiveServerRecord,
  LlmUsageLogRecord,
  LlmUsageRecord,
  RedeemedInvitationResult,
  RunResultRecord,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequestRecord,
  DocumentRecord,
  SnippetRecord,
  SnippetScope,
  TenantAvatarImageUpdate,
  TenantRecord,
  UpdateUserInput,
  UpdateLivePageRecordInput,
  UpdateLiveServerRecordInput,
  UserRecord,
  Variable,
  CreateDiscussionCommentInput,
  DiscussionCommentRecord,
  ListDiscussionCommentsOptions,
  ListDiscussionCommentsResult,
  UpdateDiscussionCommentInput,
  CreateNoticeInput,
  ListNoticesOptions,
  ListNoticesResult,
  NoticeRecord,
  NotificationLevel,
  UserNotificationSettingsRecord,
  DiscussionThreadSubscriptionRecord,
  DiscussionMlsGroupStateRecord,
  DiscussionMlsCommitRecord,
  DiscussionMlsWelcomeRecord,
  UpsertDiscussionMlsGroupStateInput,
  ListDiscussionMlsCommitsOptions,
  ListDiscussionMlsCommitsResult,
  ListDiscussionMlsWelcomesOptions,
  ListDiscussionMlsWelcomesResult
} from '#/db/types.js';
import { DEFAULT_AUTH_JSON } from '#/db/types.js';
import { formatZodError } from '#/db/validation.js';

const { Pool } = pg;

/**
 * Builds `pg.Pool` constructor options from validated Postgres config.
 *
 * Optional pool and TLS fields are included only when set so driver defaults
 * remain unchanged for existing server.yaml files.
 *
 * @param config - Validated Postgres connection settings.
 * @returns Options for `new Pool(...)`.
 */
function buildPostgresPoolOptions(config: PostgresDatabaseConfig): pg.PoolConfig {
  const options: pg.PoolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  };

  if (config.max !== undefined) {
    options.max = config.max;
  }
  if (config.idleTimeoutMillis !== undefined) {
    options.idleTimeoutMillis = config.idleTimeoutMillis;
  }
  if (config.connectionTimeoutMillis !== undefined) {
    options.connectionTimeoutMillis = config.connectionTimeoutMillis;
  }
  if (config.ssl !== undefined) {
    options.ssl = config.ssl;
  }

  return options;
}

const COLLECTION_SELECT = `SELECT ${COLLECTION_SELECT_COLUMNS} FROM collections`;
const ENVIRONMENT_SELECT = `SELECT ${ENVIRONMENT_SELECT_COLUMNS} FROM environments`;
const SNIPPET_SELECT = `SELECT ${SNIPPET_SELECT_COLUMNS} FROM snippets`;
const PAYLOAD_ENTITY_SELECT_COLUMNS =
  'id, name, payload, created_at, updated_at, created_by_user_id, updated_by_user_id, deletion_locked';
const RUN_RESULT_SELECT_COLUMNS =
  'id, kind, label, collection_name, request_name, summary_passed, summary_failed, summary_skipped, payload, created_at, created_by_user_id';
const RUN_RESULT_SELECT = `SELECT ${RUN_RESULT_SELECT_COLUMNS} FROM run_results`;
const DISCUSSION_COMMENT_SELECT = `SELECT ${DISCUSSION_COMMENT_SELECT_COLUMNS} FROM discussion_comments`;
const NOTICE_SELECT = `SELECT ${NOTICE_SELECT_COLUMNS} FROM notices`;
const USER_SELECT = `SELECT ${USER_SELECT_COLUMNS} FROM users`;
const API_TOKEN_SELECT = `SELECT ${API_TOKEN_SELECT_COLUMNS} FROM api_tokens`;
const DEVICE_KEY_SELECT = `SELECT ${DEVICE_KEY_SELECT_COLUMNS} FROM device_keys`;
const DISCUSSION_MLS_GROUP_STATE_SELECT = `SELECT ${DISCUSSION_MLS_GROUP_STATE_SELECT_COLUMNS} FROM discussion_mls_group_state`;
const DISCUSSION_MLS_COMMIT_SELECT = `SELECT ${DISCUSSION_MLS_COMMIT_SELECT_COLUMNS} FROM discussion_mls_commits`;
const DISCUSSION_MLS_WELCOME_SELECT = `SELECT ${DISCUSSION_MLS_WELCOME_SELECT_COLUMNS} FROM discussion_mls_welcomes`;
const FOLDER_SELECT = `SELECT ${FOLDER_SELECT_COLUMNS} FROM folders`;
const REQUEST_SELECT = `SELECT ${REQUEST_SELECT_COLUMNS} FROM requests`;
const DOCUMENT_SELECT = `SELECT ${DOCUMENT_SELECT_COLUMNS} FROM documents`;
const LLM_USAGE_SELECT = `SELECT ${LLM_USAGE_SELECT_COLUMNS} FROM llm_usage`;
const LLM_USAGE_LOG_SELECT = `SELECT ${LLM_USAGE_LOG_SELECT_COLUMNS} FROM llm_usage_log`;

/**
 * Postgres-backed database implementation.
 */
export class PostgresDatabase implements IDatabase {
  /**
   * Active Postgres connection pool, or null when disconnected.
   */
  private pool: pg.Pool | null = null;

  /**
   * Cached identifier for the internal system user, when provisioned during migrate.
   */
  private systemUserId: string | null = null;

  /**
   * Tenant identifier for this database instance.
   */
  private tenantId: string = DEFAULT_TENANT_ID;

  /**
   * Whether this instance owns the pool (should end it on disconnect).
   */
  private ownsPool: boolean = true;

  /**
   * Creates a Postgres database instance from validated config.
   *
   * @param config - Parsed Postgres connection settings.
   */
  constructor(private readonly config: PostgresDatabaseConfig) {}

  /**
   * Validates raw config and constructs a {@link PostgresDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured Postgres database instance.
   * @throws {Error} When config fails Postgres-specific validation.
   */
  static fromConfig(config: unknown): PostgresDatabase {
    const parsed = postgresConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new PostgresDatabase({
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      password: parsed.data.password,
      database: parsed.data.database,
      max: parsed.data.max,
      idleTimeoutMillis: parsed.data.idleTimeoutMillis,
      connectionTimeoutMillis: parsed.data.connectionTimeoutMillis,
      ssl: parsed.data.ssl
    });
  }

  /**
   * Opens a Postgres connection pool and verifies connectivity with a query.
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const pool = new Pool(buildPostgresPoolOptions(this.config));

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    this.pool = pool;
  }

  /**
   * Closes the Postgres connection pool and releases resources.
   */
  async disconnect(): Promise<void> {
    if (!this.pool || !this.ownsPool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
  }

  /**
   * Verifies Postgres connectivity with `SELECT 1` for readiness probes.
   *
   * @throws {Error} When the pool is not connected or the query fails.
   */
  async ping(): Promise<void> {
    const client = await this.requirePool().connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * Returns live `pg.Pool` utilization for Prometheus scrapes.
   *
   * @returns Pool stats, or null when the pool has not been connected.
   */
  getPoolStats(): DbPoolStats | null {
    if (!this.pool) {
      return null;
    }

    return {
      backend: 'postgres',
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      max: this.config.max ?? this.pool.options.max ?? 10
    };
  }

  /**
   * Creates required tables when they do not already exist.
   */
  async migrate(): Promise<void> {
    for (const sql of POSTGRES_MIGRATIONS) {
      await this.query(sql);
    }

    await this.ensureDefaultTenant();
    await this.ensureSystemUser();
    await this.migrateOrphanTokensToBootstrapUser();
    await this.backfillUserAvatars();
  }

  /**
   * Assigns default avatar initials and colors to users missing persisted values.
   */
  private async backfillUserAvatars(): Promise<void> {
    const result = await this.query<{ id: string; name: string; tenant_id: string }>(
      `SELECT id, name, tenant_id FROM users WHERE avatar_initials IS NULL OR avatar_color IS NULL`
    );

    for (const row of result.rows) {
      const defaults = defaultAvatarPresentation(row.name, row.id);
      await this.query(
        `UPDATE users
         SET avatar_initials = $1,
             avatar_color = $2
         WHERE id = $3 AND tenant_id = $4`,
        [defaults.initials, defaults.color, row.id, row.tenant_id]
      );
    }
  }

  /**
   * Returns the stable identifier of the internal system user, when provisioned.
   */
  getSystemUserId(): string | null {
    return this.systemUserId;
  }

  /**
   * Returns the tenant identifier for this database instance.
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Creates a new database instance scoped to a different tenant.
   *
   * @param tenantId - Tenant identifier to scope queries to.
   * @returns Database instance for the specified tenant.
   */
  forTenant(tenantId: string): IDatabase {
    if (tenantId === this.tenantId) {
      return this;
    }

    const instance = new PostgresDatabase(this.config);
    instance.pool = this.pool;
    instance.tenantId = tenantId;
    instance.ownsPool = false;
    instance.systemUserId = null;
    return instance;
  }

  /**
   * Ensures the default tenant exists in the tenants table.
   */
  async ensureDefaultTenant(): Promise<void> {
    const existing = await this.findTenantById(DEFAULT_TENANT_ID);
    if (existing) {
      return;
    }

    const now = new Date();
    await this.query(
      `INSERT INTO tenants (id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_TENANT_ID, 'Default', now, now]
    );
  }

  /**
   * Lists all tenants ordered by name.
   */
  async listTenants(): Promise<TenantRecord[]> {
    const result = await this.query<{
      id: string;
      name: string;
      created_at: Date;
      updated_at: Date;
      created_by_user_id: string | null;
      updated_by_user_id: string | null;
      avatar_initials: string | null;
      avatar_color: string | null;
      avatar_image: string | null;
      avatar_image_key: string | null;
      avatar_image_mime: string | null;
      avatar_image_updated_at: Date | null;
    }>(
      'SELECT id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color, avatar_image, avatar_image_key, avatar_image_mime, avatar_image_updated_at FROM tenants ORDER BY name ASC'
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      avatarInitials: row.avatar_initials,
      avatarColor: row.avatar_color,
      avatarImage: row.avatar_image,
      avatarImageKey: row.avatar_image_key,
      avatarImageMime: row.avatar_image_mime,
      avatarImageUpdatedAt: row.avatar_image_updated_at
    }));
  }

  /**
   * Creates a new tenant.
   *
   * @param id - Unique tenant identifier.
   * @param name - Display name for the tenant.
   * @param actingUserId - User performing the create action.
   */
  async createTenant(id: string, name: string, actingUserId: string): Promise<TenantRecord> {
    if (id === DEFAULT_TENANT_ID) {
      throw new Error('Cannot create tenant with reserved ID');
    }

    const trimmedName = trimRequiredName(name, 'Tenant name');
    const now = new Date();

    const result = await this.query<{
      id: string;
      name: string;
      created_at: Date;
      updated_at: Date;
      created_by_user_id: string | null;
      updated_by_user_id: string | null;
      avatar_initials: string | null;
      avatar_color: string | null;
      avatar_image: string | null;
      avatar_image_key: string | null;
      avatar_image_mime: string | null;
      avatar_image_updated_at: Date | null;
    }>(
      `INSERT INTO tenants (id, name, created_at, updated_at, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color, avatar_image, avatar_image_key, avatar_image_mime, avatar_image_updated_at`,
      [id, trimmedName, now, now, actingUserId, actingUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Tenant not found after insert');
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      avatarInitials: row.avatar_initials,
      avatarColor: row.avatar_color,
      avatarImage: row.avatar_image,
      avatarImageKey: row.avatar_image_key,
      avatarImageMime: row.avatar_image_mime,
      avatarImageUpdatedAt: row.avatar_image_updated_at
    };
  }

  /**
   * Finds a tenant by stable identifier.
   *
   * @param id - Tenant identifier to look up.
   */
  async findTenantById(id: string): Promise<TenantRecord | null> {
    const result = await this.query<{
      id: string;
      name: string;
      created_at: Date;
      updated_at: Date;
      created_by_user_id: string | null;
      updated_by_user_id: string | null;
      avatar_initials: string | null;
      avatar_color: string | null;
      avatar_image: string | null;
      avatar_image_key: string | null;
      avatar_image_mime: string | null;
      avatar_image_updated_at: Date | null;
    }>(
      'SELECT id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color, avatar_image, avatar_image_key, avatar_image_mime, avatar_image_updated_at FROM tenants WHERE id = $1 LIMIT 1',
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      avatarInitials: row.avatar_initials,
      avatarColor: row.avatar_color,
      avatarImage: row.avatar_image,
      avatarImageKey: row.avatar_image_key,
      avatarImageMime: row.avatar_image_mime,
      avatarImageUpdatedAt: row.avatar_image_updated_at
    };
  }

  /**
   * Updates persisted hub avatar presentation for a tenant namespace.
   *
   * @param id - Tenant identifier to update.
   * @param avatarInitials - Initials tile text to persist.
   * @param avatarColor - Palette color key to persist.
   * @param actingUserId - User performing the update, or null for system assignment.
   * @param image - Optional uploaded image fields; omit to leave the image unchanged.
   */
  async updateTenantAvatar(
    id: string,
    avatarInitials: string,
    avatarColor: string,
    actingUserId: string | null,
    image?: TenantAvatarImageUpdate
  ): Promise<TenantRecord> {
    const now = new Date();
    const result =
      image === undefined
        ? await this.query<{
            id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            created_by_user_id: string | null;
            updated_by_user_id: string | null;
            avatar_initials: string | null;
            avatar_color: string | null;
            avatar_image: string | null;
            avatar_image_key: string | null;
            avatar_image_mime: string | null;
            avatar_image_updated_at: Date | null;
          }>(
            `UPDATE tenants
             SET avatar_initials = $2,
                 avatar_color = $3,
                 updated_at = $4,
                 updated_by_user_id = COALESCE($5, updated_by_user_id)
             WHERE id = $1
             RETURNING id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color, avatar_image, avatar_image_key, avatar_image_mime, avatar_image_updated_at`,
            [id, avatarInitials, avatarColor, now, actingUserId]
          )
        : await this.query<{
            id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            created_by_user_id: string | null;
            updated_by_user_id: string | null;
            avatar_initials: string | null;
            avatar_color: string | null;
            avatar_image: string | null;
            avatar_image_key: string | null;
            avatar_image_mime: string | null;
            avatar_image_updated_at: Date | null;
          }>(
            `UPDATE tenants
             SET avatar_initials = $2,
                 avatar_color = $3,
                 avatar_image = $4,
                 avatar_image_key = $5,
                 avatar_image_mime = $6,
                 avatar_image_updated_at = $7,
                 updated_at = $8,
                 updated_by_user_id = COALESCE($9, updated_by_user_id)
             WHERE id = $1
             RETURNING id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color, avatar_image, avatar_image_key, avatar_image_mime, avatar_image_updated_at`,
            [
              id,
              avatarInitials,
              avatarColor,
              image.imageBase64,
              image.imageKey,
              image.mime,
              image.updatedAt,
              now,
              actingUserId
            ]
          );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Tenant not found.');
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      avatarInitials: row.avatar_initials,
      avatarColor: row.avatar_color,
      avatarImage: row.avatar_image,
      avatarImageKey: row.avatar_image_key,
      avatarImageMime: row.avatar_image_mime,
      avatarImageUpdatedAt: row.avatar_image_updated_at
    };
  }

  /**
   * Deletes a tenant and all associated data.
   *
   * @param id - Tenant identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteTenant(id: string, actingUserId: string): Promise<void> {
    if (id === DEFAULT_TENANT_ID) {
      throw new Error('Cannot delete default tenant');
    }

    void actingUserId;

    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM documents WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM requests WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM folders WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM run_results WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM discussion_comments WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM llm_usage_log WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM llm_usage WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM audit_log WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM user_invitations WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM api_tokens WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM snippets WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM live_pages WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM live_servers WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM environments WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM collections WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM users WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM tenants WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lists audit log entries ordered newest-first with optional filters.
   *
   * @param options - Optional limit and filter criteria.
   */
  async listAuditLog(options?: ListAuditLogOptions): Promise<AuditLogRecord[]> {
    const limit = options?.limit ?? 100;
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [this.tenantId];
    let paramIndex = 2;

    if (options?.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(options.entityType);
    }

    if (options?.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(options.entityId);
    }

    params.push(limit);

    const result = await this.query<AuditLogSqlRow>(
      `SELECT ${AUDIT_LOG_SELECT_COLUMNS} FROM audit_log
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}`,
      params
    );

    return result.rows.map(mapAuditLogSqlRow);
  }

  /**
   * Creates a new user account with the given role and access lists.
   *
   * @param input - User fields to persist.
   * @param actingUserId - User performing the create action.
   */
  async createUser(input: CreateUserInput, actingUserId: string): Promise<UserRecord> {
    const trimmedName = trimRequiredName(input.name, 'User name');
    assertUserNameNotReserved(trimmedName);
    const id = randomUUID();
    const now = new Date();
    const avatar = buildUserAvatarFieldsForCreate(trimmedName, id, input);

    const result = await this.query<UserSqlRow>(
      `INSERT INTO users (
        id,
        tenant_id,
        name,
        role,
        collection_access,
        environment_access,
        snippet_access,
        live_server_access,
        live_page_access,
        llm_access,
        llm_models,
        llm_monthly_token_limit,
        avatar_initials,
        avatar_color,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING ${USER_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        trimmedName,
        input.role,
        serializeAccessList(input.collectionAccess),
        serializeAccessList(input.environmentAccess),
        serializeAccessList(input.snippetAccess),
        serializeAccessList(input.liveServerAccess),
        serializeAccessList(input.livePageAccess),
        input.llmAccess ?? false,
        serializeAccessList(input.llmModels ?? []),
        input.llmMonthlyTokenLimit ?? null,
        avatar.avatarInitials,
        avatar.avatarColor,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('User not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'user', id);

    return mapUserSqlRow(row);
  }

  /**
   * Finds a user by stable identifier.
   *
   * @param id - User identifier to look up.
   */
  async findUserById(id: string): Promise<UserRecord | null> {
    const result = await this.query<UserSqlRow>(
      `${USER_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapUserSqlRow(row) : null;
  }

  /**
   * Finds a user by unique display name.
   *
   * @param name - User name to look up.
   */
  async findUserByName(name: string): Promise<UserRecord | null> {
    const result = await this.query<UserSqlRow>(
      `${USER_SELECT} WHERE name = $1 AND tenant_id = $2 LIMIT 1`,
      [name, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapUserSqlRow(row) : null;
  }

  /**
   * Lists all user accounts ordered by name.
   */
  async listUsers(): Promise<UserRecord[]> {
    const result = await this.query<UserSqlRow>(
      `${USER_SELECT} WHERE tenant_id = $1 ORDER BY name ASC`,
      [this.tenantId]
    );
    return result.rows.map(mapUserSqlRow);
  }

  /**
   * Updates an existing user account.
   *
   * @param id - User identifier to update.
   * @param input - Partial fields to apply.
   * @param actingUserId - User performing the update action.
   */
  async updateUser(id: string, input: UpdateUserInput, actingUserId: string): Promise<UserRecord> {
    const existing = await this.findUserById(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const name =
      input.name !== undefined ? trimRequiredName(input.name, 'User name') : existing.name;

    if (name !== existing.name) {
      assertUserNameNotReserved(name);
      const duplicate = await this.findUserByName(name);
      assertUserNameAvailable(name, id, duplicate);
    }

    const role = input.role ?? existing.role;
    const collectionAccess = input.collectionAccess ?? existing.collectionAccess;
    const environmentAccess = input.environmentAccess ?? existing.environmentAccess;
    const snippetAccess = input.snippetAccess ?? existing.snippetAccess;
    const liveServerAccess = input.liveServerAccess ?? existing.liveServerAccess;
    const livePageAccess = input.livePageAccess ?? existing.livePageAccess;
    const llmAccess = input.llmAccess ?? existing.llmAccess;
    const llmModels = input.llmModels ?? existing.llmModels;
    const llmMonthlyTokenLimit =
      input.llmMonthlyTokenLimit !== undefined
        ? input.llmMonthlyTokenLimit
        : existing.llmMonthlyTokenLimit;
    const avatarInitials =
      input.avatarInitials !== undefined ? input.avatarInitials : existing.avatarInitials;
    const avatarColor = input.avatarColor !== undefined ? input.avatarColor : existing.avatarColor;
    const avatarImage = input.avatarImage !== undefined ? input.avatarImage : existing.avatarImage;
    const avatarImageKey =
      input.avatarImageKey !== undefined ? input.avatarImageKey : existing.avatarImageKey;
    const avatarImageMime =
      input.avatarImageMime !== undefined ? input.avatarImageMime : existing.avatarImageMime;
    const avatarImageUpdatedAt =
      input.avatarImageUpdatedAt !== undefined
        ? input.avatarImageUpdatedAt
        : existing.avatarImageUpdatedAt;
    const updatedAt = new Date();

    const result = await this.query(
      `UPDATE users
      SET name = $1,
        role = $2,
        collection_access = $3,
        environment_access = $4,
        snippet_access = $5,
        live_server_access = $6,
        live_page_access = $7,
        llm_access = $8,
        llm_models = $9,
        llm_monthly_token_limit = $10,
        avatar_initials = $11,
        avatar_color = $12,
        avatar_image = $13,
        avatar_image_key = $14,
        avatar_image_mime = $15,
        avatar_image_updated_at = $16,
        updated_at = $17,
        updated_by_user_id = $18
      WHERE id = $19 AND tenant_id = $20`,
      [
        name,
        role,
        serializeAccessList(collectionAccess),
        serializeAccessList(environmentAccess),
        serializeAccessList(snippetAccess),
        serializeAccessList(liveServerAccess),
        serializeAccessList(livePageAccess),
        llmAccess,
        serializeAccessList(llmModels),
        llmMonthlyTokenLimit,
        avatarInitials,
        avatarColor,
        avatarImage,
        avatarImageKey,
        avatarImageMime,
        avatarImageUpdatedAt,
        updatedAt,
        actingUserId,
        id,
        this.tenantId
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('User not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'user', id);

    const updated = await this.findUserById(id);
    if (!updated) {
      throw new Error('User not found');
    }

    return updated;
  }

  /**
   * Deletes a user account and revokes all of their API tokens.
   *
   * @param id - User identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteUser(id: string, actingUserId: string): Promise<void> {
    const client = await this.requirePool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM api_tokens WHERE user_id = $1 AND tenant_id = $2', [
        id,
        this.tenantId
      ]);
      await client.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, this.tenantId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'user', id);
  }

  /**
   * Assigns legacy API tokens without an owner to the bootstrap user.
   */
  async migrateOrphanTokensToBootstrapUser(): Promise<void> {
    const orphanResult = await this.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM api_tokens WHERE user_id IS NULL AND tenant_id = $1',
      [this.tenantId]
    );
    const orphanCount = Number(orphanResult.rows[0]?.count ?? 0);
    if (orphanCount === 0) {
      return;
    }

    const systemUserId = this.getSystemUserId();
    if (!systemUserId) {
      throw new Error('System user is not provisioned');
    }

    let bootstrapUser = await this.findUserByName(BOOTSTRAP_USER_NAME);
    if (!bootstrapUser) {
      bootstrapUser = await this.createUser(
        {
          name: BOOTSTRAP_USER_NAME,
          role: 'user',
          collectionAccess: ['*'],
          environmentAccess: ['*'],
          snippetAccess: ['*'],
          liveServerAccess: ['*'],
          livePageAccess: ['*']
        },
        systemUserId
      );
    }

    await this.query(
      'UPDATE api_tokens SET user_id = $1 WHERE user_id IS NULL AND tenant_id = $2',
      [bootstrapUser.id, this.tenantId]
    );
  }

  /**
   * Inserts a new API token record.
   *
   * @param record - Token metadata to persist.
   * @param actingUserId - User performing the create action.
   */
  async createApiToken(record: ApiTokenRecord, actingUserId: string): Promise<void> {
    await this.query(
      `INSERT INTO api_tokens (
        id,
        tenant_id,
        user_id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.id,
        this.tenantId,
        record.userId,
        record.name,
        record.tokenHash,
        record.tokenPrefix,
        record.createdAt,
        record.lastUsedAt,
        record.revokedAt,
        actingUserId,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'api_token', record.id);
  }

  /**
   * Finds an active token by its stored hash.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   */
  async findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
    const result = await this.query<ApiTokenSqlRow>(
      `${API_TOKEN_SELECT}
      WHERE token_hash = $1
        AND tenant_id = $2
        AND revoked_at IS NULL
        AND user_id IS NOT NULL
      LIMIT 1`,
      [tokenHash, this.tenantId]
    );

    const row = result.rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const result = await this.query<ApiTokenSqlRow>(
      `${API_TOKEN_SELECT}
      WHERE tenant_id = $1
        AND user_id IS NOT NULL
      ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return result.rows.map(mapApiTokenSqlRow);
  }

  /**
   * Returns API tokens owned by a specific user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listApiTokensByUserId(userId: string): Promise<ApiTokenRecord[]> {
    const result = await this.query<ApiTokenSqlRow>(
      `${API_TOKEN_SELECT}
      WHERE user_id = $1
        AND tenant_id = $2
      ORDER BY created_at DESC`,
      [userId, this.tenantId]
    );

    return result.rows.map(mapApiTokenSqlRow);
  }

  /**
   * Finds an API token record by stable identifier.
   *
   * @param id - Token identifier to look up.
   */
  async findApiTokenById(id: string): Promise<ApiTokenRecord | null> {
    const result = await this.query<ApiTokenSqlRow>(
      `${API_TOKEN_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Permanently removes an API token record by id.
   *
   * @param id - Token identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteApiToken(id: string, actingUserId: string): Promise<boolean> {
    const result = await this.query('DELETE FROM api_tokens WHERE id = $1 AND tenant_id = $2', [
      id,
      this.tenantId
    ]);
    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      await this.recordAuditEntry(actingUserId, 'delete', 'api_token', id);
    }

    return deleted;
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeApiToken(id: string, actingUserId: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE api_tokens
      SET revoked_at = $2,
        updated_by_user_id = $3
      WHERE id = $1
        AND tenant_id = $4
        AND revoked_at IS NULL`,
      [id, new Date(), actingUserId, this.tenantId]
    );

    const revoked = (result.rowCount ?? 0) > 0;
    if (revoked) {
      await this.recordAuditEntry(actingUserId, 'update', 'api_token', id);
    }

    return revoked;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.query(`UPDATE api_tokens SET last_used_at = $2 WHERE id = $1 AND tenant_id = $3`, [
      id,
      when,
      this.tenantId
    ]);
  }

  /**
   * Inserts a new device key enrollment record.
   *
   * @param record - Device enrollment metadata to persist.
   * @param actingUserId - User performing the enrollment action.
   */
  async createDeviceKey(record: DeviceKeyRecord, actingUserId: string): Promise<void> {
    await this.query(
      `INSERT INTO device_keys (
        id,
        tenant_id,
        user_id,
        device_id,
        label,
        key_format,
        public_key_material,
        fingerprint,
        created_at,
        last_seen_at,
        revoked_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        record.id,
        this.tenantId,
        record.userId,
        record.deviceId,
        record.label,
        record.keyFormat,
        record.publicKeyMaterial,
        record.fingerprint,
        record.createdAt,
        record.lastSeenAt,
        record.revokedAt,
        actingUserId,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'device_key', record.id);
  }

  /**
   * Finds a device key enrollment by stable identifier.
   *
   * @param id - Device key record identifier.
   */
  async findDeviceKeyById(id: string): Promise<DeviceKeyRecord | null> {
    const result = await this.query<DeviceKeySqlRow>(
      `${DEVICE_KEY_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );

    const row = result.rows[0];
    return row ? mapDeviceKeySqlRow(row) : null;
  }

  /**
   * Finds an active enrollment for a user/device pair.
   *
   * @param userId - Owning user identifier.
   * @param deviceId - Client-generated device identifier.
   */
  async findActiveDeviceKeyByUserAndDeviceId(
    userId: string,
    deviceId: string
  ): Promise<DeviceKeyRecord | null> {
    const result = await this.query<DeviceKeySqlRow>(
      `${DEVICE_KEY_SELECT}
      WHERE user_id = $1
        AND device_id = $2
        AND tenant_id = $3
        AND revoked_at IS NULL
      LIMIT 1`,
      [userId, deviceId, this.tenantId]
    );

    const row = result.rows[0];
    return row ? mapDeviceKeySqlRow(row) : null;
  }

  /**
   * Returns device key enrollments owned by a user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listDeviceKeysByUserId(userId: string): Promise<DeviceKeyRecord[]> {
    const result = await this.query<DeviceKeySqlRow>(
      `${DEVICE_KEY_SELECT}
      WHERE user_id = $1
        AND tenant_id = $2
      ORDER BY created_at DESC`,
      [userId, this.tenantId]
    );

    return result.rows.map(mapDeviceKeySqlRow);
  }

  /**
   * Lists all device key enrollments ordered by creation time descending.
   */
  async listDeviceKeys(): Promise<DeviceKeyRecord[]> {
    const result = await this.query<DeviceKeySqlRow>(
      `${DEVICE_KEY_SELECT}
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return result.rows.map(mapDeviceKeySqlRow);
  }

  /**
   * Soft-revokes an active device key enrollment by id.
   *
   * @param id - Device key identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeDeviceKey(id: string, actingUserId: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE device_keys
      SET revoked_at = $2,
        updated_by_user_id = $3
      WHERE id = $1
        AND tenant_id = $4
        AND revoked_at IS NULL`,
      [id, new Date(), actingUserId, this.tenantId]
    );

    const revoked = (result.rowCount ?? 0) > 0;
    if (revoked) {
      await this.recordAuditEntry(actingUserId, 'update', 'device_key', id);
    }

    return revoked;
  }

  /**
   * Updates the last-seen timestamp for an enrolled device.
   *
   * @param id - Device key identifier.
   * @param when - Timestamp of the latest successful enrollment confirmation.
   */
  async touchDeviceKeyLastSeen(id: string, when: Date): Promise<void> {
    await this.query(`UPDATE device_keys SET last_seen_at = $2 WHERE id = $1 AND tenant_id = $3`, [
      id,
      when,
      this.tenantId
    ]);
  }

  /**
   * Returns persisted MLS group state for a discussion thread.
   *
   * @param mlsGroupId - Canonical MLS group id for the thread.
   */
  async getDiscussionMlsGroupState(
    mlsGroupId: string
  ): Promise<DiscussionMlsGroupStateRecord | null> {
    const result = await this.query<DiscussionMlsGroupStateSqlRow>(
      `${DISCUSSION_MLS_GROUP_STATE_SELECT}
      WHERE tenant_id = $1 AND mls_group_id = $2
      LIMIT 1`,
      [this.tenantId, mlsGroupId]
    );

    const row = result.rows[0];
    return row ? mapDiscussionMlsGroupStateSqlRow(row) : null;
  }

  /**
   * Inserts or advances MLS group state when the supplied epoch is not stale.
   *
   * @param input - Latest observed MLS epoch for the thread.
   * @param actingUserId - User posting the commit that advanced group state.
   */
  async upsertDiscussionMlsGroupState(
    input: UpsertDiscussionMlsGroupStateInput,
    actingUserId: string
  ): Promise<DiscussionMlsGroupStateRecord> {
    const prepared = buildDiscussionMlsGroupStateRecord(input, actingUserId);
    const existing = await this.getDiscussionMlsGroupState(prepared.mlsGroupId);

    const result = await this.query<DiscussionMlsGroupStateSqlRow>(
      `INSERT INTO discussion_mls_group_state (
        mls_group_id,
        tenant_id,
        target_entity_type,
        target_entity_id,
        current_epoch,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, mls_group_id) DO UPDATE SET
        current_epoch = CASE
          WHEN EXCLUDED.current_epoch >= discussion_mls_group_state.current_epoch
          THEN EXCLUDED.current_epoch
          ELSE discussion_mls_group_state.current_epoch
        END,
        updated_at = CASE
          WHEN EXCLUDED.current_epoch >= discussion_mls_group_state.current_epoch
          THEN EXCLUDED.updated_at
          ELSE discussion_mls_group_state.updated_at
        END,
        updated_by_user_id = CASE
          WHEN EXCLUDED.current_epoch >= discussion_mls_group_state.current_epoch
          THEN EXCLUDED.updated_by_user_id
          ELSE discussion_mls_group_state.updated_by_user_id
        END
      RETURNING ${DISCUSSION_MLS_GROUP_STATE_SELECT_COLUMNS}`,
      [
        prepared.mlsGroupId,
        this.tenantId,
        prepared.targetEntityType,
        prepared.targetEntityId,
        prepared.currentEpoch,
        prepared.createdAt,
        prepared.updatedAt,
        prepared.createdByUserId,
        prepared.updatedByUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Discussion MLS group state not found after upsert');
    }

    const record = mapDiscussionMlsGroupStateSqlRow(row);
    if (!existing) {
      await this.recordAuditEntry(
        actingUserId,
        'create',
        'discussion_mls_group_state',
        prepared.mlsGroupId
      );
    } else if (record.currentEpoch > existing.currentEpoch) {
      await this.recordAuditEntry(
        actingUserId,
        'update',
        'discussion_mls_group_state',
        prepared.mlsGroupId
      );
    }

    return record;
  }

  /**
   * Persists a relayed MLS commit record built by the route layer.
   *
   * @param record - Validated commit metadata and ciphertext.
   * @param actingUserId - User relaying the commit through Team Hub.
   */
  async createDiscussionMlsCommit(
    record: DiscussionMlsCommitRecord,
    actingUserId: string
  ): Promise<void> {
    await this.query(
      `INSERT INTO discussion_mls_commits (
        id,
        tenant_id,
        mls_group_id,
        epoch,
        ciphertext,
        sender_device_id,
        created_at,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        this.tenantId,
        record.mlsGroupId,
        record.epoch,
        record.ciphertext,
        record.senderDeviceId,
        record.createdAt,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'discussion_mls_commit', record.id);
  }

  /**
   * Lists MLS commits for offline catch-up with epoch-based cursor pagination.
   *
   * @param options - Group id, optional cursor, and page size.
   */
  async listDiscussionMlsCommits(
    options: ListDiscussionMlsCommitsOptions
  ): Promise<ListDiscussionMlsCommitsResult> {
    const limit = normalizeDiscussionMlsCommitListLimit(options.limit);
    const cursorEpoch = parseDiscussionMlsCommitListCursor(options.cursor);

    const result = await this.query<DiscussionMlsCommitSqlRow>(
      `${DISCUSSION_MLS_COMMIT_SELECT}
      WHERE tenant_id = $1
        AND mls_group_id = $2
        AND ($3::int IS NULL OR epoch > $3)
      ORDER BY epoch ASC
      LIMIT $4`,
      [this.tenantId, options.mlsGroupId, cursorEpoch, limit + 1]
    );

    return buildDiscussionMlsCommitListResult(result.rows.map(mapDiscussionMlsCommitSqlRow), limit);
  }

  /**
   * Finds a relayed MLS commit by stable identifier.
   *
   * @param id - Commit record identifier.
   */
  async findDiscussionMlsCommitById(id: string): Promise<DiscussionMlsCommitRecord | null> {
    const result = await this.query<DiscussionMlsCommitSqlRow>(
      `${DISCUSSION_MLS_COMMIT_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );

    const row = result.rows[0];
    return row ? mapDiscussionMlsCommitSqlRow(row) : null;
  }

  /**
   * Persists a relayed MLS welcome record built by the route layer.
   *
   * @param record - Validated welcome metadata and ciphertext.
   * @param actingUserId - User relaying the welcome through Team Hub.
   */
  async createDiscussionMlsWelcome(
    record: DiscussionMlsWelcomeRecord,
    actingUserId: string
  ): Promise<void> {
    await this.query(
      `INSERT INTO discussion_mls_welcomes (
        id,
        tenant_id,
        mls_group_id,
        recipient_device_id,
        ciphertext,
        ratchet_tree,
        created_at,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        this.tenantId,
        record.mlsGroupId,
        record.recipientDeviceId,
        record.ciphertext,
        record.ratchetTree,
        record.createdAt,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'discussion_mls_welcome', record.id);
  }

  /**
   * Lists MLS welcomes for a discussion thread, optionally filtered by recipient device.
   *
   * @param options - Group id and optional recipient device filter.
   */
  async listDiscussionMlsWelcomes(
    options: ListDiscussionMlsWelcomesOptions
  ): Promise<ListDiscussionMlsWelcomesResult> {
    const result = await this.query<DiscussionMlsWelcomeSqlRow>(
      `${DISCUSSION_MLS_WELCOME_SELECT}
      WHERE tenant_id = $1
        AND mls_group_id = $2
        AND ($3::text IS NULL OR recipient_device_id = $3)
      ORDER BY created_at ASC`,
      [this.tenantId, options.mlsGroupId, options.recipientDeviceId ?? null]
    );

    return {
      welcomes: result.rows.map(mapDiscussionMlsWelcomeSqlRow)
    };
  }

  /**
   * Finds a relayed MLS welcome by stable identifier.
   *
   * @param id - Welcome record identifier.
   */
  async findDiscussionMlsWelcomeById(id: string): Promise<DiscussionMlsWelcomeRecord | null> {
    const result = await this.query<DiscussionMlsWelcomeSqlRow>(
      `${DISCUSSION_MLS_WELCOME_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );

    const row = result.rows[0];
    return row ? mapDiscussionMlsWelcomeSqlRow(row) : null;
  }

  /**
   * Creates a user account and its initial onboarding invitation in one transaction.
   *
   * @param userId - Pre-generated stable identifier for the new user.
   * @param input - User fields to persist.
   * @param invitation - Invitation metadata including the stored code hash.
   * @param actingUserId - User performing the create action.
   */
  async createInvitedUser(
    userId: string,
    input: CreateUserInput,
    invitation: InvitationRecord,
    actingUserId: string
  ): Promise<CreatedInvitedUserResult> {
    const trimmedName = trimRequiredName(input.name, 'User name');
    assertUserNameNotReserved(trimmedName);
    const now = new Date();
    const client = await this.requirePool().connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query<UserSqlRow>(
        `INSERT INTO users (
          id,
          tenant_id,
          name,
          role,
          collection_access,
          environment_access,
          snippet_access,
          live_server_access,
          live_page_access,
          llm_access,
          llm_models,
          llm_monthly_token_limit,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING ${USER_SELECT_COLUMNS}`,
        [
          userId,
          this.tenantId,
          trimmedName,
          input.role,
          serializeAccessList(input.collectionAccess),
          serializeAccessList(input.environmentAccess),
          serializeAccessList(input.snippetAccess),
          serializeAccessList(input.liveServerAccess),
          serializeAccessList(input.livePageAccess),
          input.llmAccess ?? false,
          serializeAccessList(input.llmModels ?? []),
          input.llmMonthlyTokenLimit ?? null,
          now,
          now,
          actingUserId,
          actingUserId
        ]
      );

      const userRow = userResult.rows[0];
      if (!userRow) {
        throw new Error('User not found after insert');
      }

      await client.query(
        `INSERT INTO user_invitations (
          id,
          tenant_id,
          user_id,
          code_hash,
          code_prefix,
          expires_at,
          redeemed_at,
          revoked_at,
          created_at,
          created_by_user_id,
          updated_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          invitation.id,
          this.tenantId,
          invitation.userId,
          invitation.codeHash,
          invitation.codePrefix,
          invitation.expiresAt,
          invitation.redeemedAt,
          invitation.revokedAt,
          invitation.createdAt,
          actingUserId,
          actingUserId
        ]
      );

      await client.query('COMMIT');

      await this.recordAuditEntry(actingUserId, 'create', 'user', userId);
      await this.recordAuditEntry(actingUserId, 'create', 'invitation', invitation.id);

      return {
        user: mapUserSqlRow(userRow),
        invitation
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Persists a new onboarding invitation for an existing user account.
   *
   * @param invitation - Invitation metadata including the stored code hash.
   * @param actingUserId - User performing the create action.
   */
  async createInvitation(
    invitation: InvitationRecord,
    actingUserId: string
  ): Promise<InvitationRecord> {
    const user = await this.findUserById(invitation.userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.query(
      `INSERT INTO user_invitations (
        id,
        tenant_id,
        user_id,
        code_hash,
        code_prefix,
        expires_at,
        redeemed_at,
        revoked_at,
        created_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        invitation.id,
        this.tenantId,
        invitation.userId,
        invitation.codeHash,
        invitation.codePrefix,
        invitation.expiresAt,
        invitation.redeemedAt,
        invitation.revokedAt,
        invitation.createdAt,
        actingUserId,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'invitation', invitation.id);
    return invitation;
  }

  /**
   * Finds an invitation by stable identifier.
   *
   * @param id - Invitation identifier to look up.
   */
  async findInvitationById(id: string): Promise<InvitationRecord | null> {
    const result = await this.query<InvitationSqlRow>(
      `${INVITATION_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapInvitationSqlRow(row) : null;
  }

  /**
   * Finds an invitation by the sha256 hash of its secret.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   */
  async findInvitationByCodeHash(codeHash: string): Promise<InvitationRecord | null> {
    const result = await this.query<InvitationSqlRow>(
      `${INVITATION_SELECT} WHERE code_hash = $1 AND tenant_id = $2 LIMIT 1`,
      [codeHash, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapInvitationSqlRow(row) : null;
  }

  /**
   * Lists all invitations ordered by creation time descending.
   */
  async listInvitations(): Promise<InvitationRecord[]> {
    const result = await this.query<InvitationSqlRow>(
      `${INVITATION_SELECT} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [this.tenantId]
    );
    return result.rows.map(mapInvitationSqlRow);
  }

  /**
   * Revokes a pending invitation by id.
   *
   * @param id - Invitation identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeInvitation(id: string, actingUserId: string): Promise<boolean> {
    const now = new Date();
    const result = await this.query<{ id: string }>(
      `UPDATE user_invitations
      SET revoked_at = $1, updated_by_user_id = $2
      WHERE id = $3
        AND tenant_id = $4
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > $1
      RETURNING id`,
      [now, actingUserId, id, this.tenantId]
    );

    if (!result.rows[0]) {
      return false;
    }

    await this.recordAuditEntry(actingUserId, 'update', 'invitation', id);
    return true;
  }

  /**
   * Atomically consumes a pending invitation and issues a permanent API token.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   * @param tokenName - Label stored on the newly created API token.
   * @param actingUserId - Internal user attributed with the redemption action.
   */
  async redeemInvitation(
    codeHash: string,
    tokenName: string,
    actingUserId: string
  ): Promise<RedeemedInvitationResult> {
    const now = new Date();
    const client = await this.requirePool().connect();

    try {
      await client.query('BEGIN');

      const claimResult = await client.query<InvitationSqlRow>(
        `UPDATE user_invitations
        SET redeemed_at = $1, updated_by_user_id = $2
        WHERE code_hash = $3
          AND tenant_id = $4
          AND redeemed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > $1
        RETURNING ${INVITATION_SELECT_COLUMNS}`,
        [now, actingUserId, codeHash, this.tenantId]
      );

      const invitationRow = claimResult.rows[0];
      if (!invitationRow) {
        const existingResult = await client.query<InvitationSqlRow>(
          `${INVITATION_SELECT} WHERE code_hash = $1 AND tenant_id = $2 LIMIT 1`,
          [codeHash, this.tenantId]
        );
        const existingRow = existingResult.rows[0];
        if (!existingRow) {
          throw new InvitationUnavailableError('not_found');
        }

        const existing = mapInvitationSqlRow(existingRow);
        if (existing.redeemedAt) {
          throw new InvitationUnavailableError('redeemed');
        }

        if (existing.revokedAt) {
          throw new InvitationUnavailableError('revoked');
        }

        throw new InvitationUnavailableError('expired');
      }

      const invitation = mapInvitationSqlRow(invitationRow);
      const userResult = await client.query<UserSqlRow>(
        `${USER_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [invitation.userId, this.tenantId]
      );
      const userRow = userResult.rows[0];
      if (!userRow) {
        throw new Error('User not found');
      }

      const user = mapUserSqlRow(userRow);
      const effectiveTokenName = tokenName.trim().length > 0 ? tokenName.trim() : user.name;
      const { record, secret } = generateApiToken(user.id, effectiveTokenName);

      await client.query(
        `INSERT INTO api_tokens (
          id,
          tenant_id,
          user_id,
          name,
          token_hash,
          token_prefix,
          created_at,
          last_used_at,
          revoked_at,
          created_by_user_id,
          updated_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.id,
          this.tenantId,
          record.userId,
          record.name,
          record.tokenHash,
          record.tokenPrefix,
          record.createdAt,
          record.lastUsedAt,
          record.revokedAt,
          actingUserId,
          actingUserId
        ]
      );

      await client.query('COMMIT');

      await this.recordAuditEntry(actingUserId, 'update', 'invitation', invitation.id);
      await this.recordAuditEntry(actingUserId, 'create', 'api_token', record.id);

      return { user, token: record, secret };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Lists all collections ordered by name.
   */
  async listCollections(): Promise<CollectionRecord[]> {
    const result = await this.query<CollectionSqlRow>(
      `${COLLECTION_SELECT} WHERE tenant_id = $1 ORDER BY name ASC`,
      [this.tenantId]
    );
    return result.rows.map(mapCollectionSqlRow);
  }

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   * @param actingUserId - User performing the create action.
   */
  async createCollection(name: string, actingUserId: string): Promise<CollectionRecord> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const id = randomUUID();
    const now = new Date();

    const result = await this.query<CollectionSqlRow>(
      `INSERT INTO collections (
        id,
        tenant_id,
        name,
        variables,
        headers,
        auth,
        pre_request_script,
        post_request_script,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, '[]', '[]', $4, '', '', $5, $6, $7, $8)
      RETURNING ${COLLECTION_SELECT_COLUMNS}`,
      [id, this.tenantId, trimmedName, DEFAULT_AUTH_JSON, now, now, actingUserId, actingUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Collection not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'collection', id);

    return mapCollectionSqlRow(row);
  }

  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param actingUserId - User performing the update action.
   */
  async updateCollection(
    id: string,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    actingUserId: string,
    marker?: string | null
  ): Promise<CollectionRecord> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const updatedAt = new Date();
    const result =
      marker !== undefined
        ? await this.query(
            `UPDATE collections
      SET name = $1,
        variables = $2,
        headers = $3,
        auth = $4,
        pre_request_script = $5,
        post_request_script = $6,
        updated_at = $7,
        updated_by_user_id = $8,
        marker = $9
      WHERE id = $10 AND tenant_id = $11`,
            [
              trimmedName,
              JSON.stringify(variables),
              JSON.stringify(headers),
              JSON.stringify(auth),
              preRequestScript,
              postRequestScript,
              updatedAt,
              actingUserId,
              serializeSidebarMarker(marker),
              id,
              this.tenantId
            ]
          )
        : await this.query(
            `UPDATE collections
      SET name = $1,
        variables = $2,
        headers = $3,
        auth = $4,
        pre_request_script = $5,
        post_request_script = $6,
        updated_at = $7,
        updated_by_user_id = $8
      WHERE id = $9 AND tenant_id = $10`,
            [
              trimmedName,
              JSON.stringify(variables),
              JSON.stringify(headers),
              JSON.stringify(auth),
              preRequestScript,
              postRequestScript,
              updatedAt,
              actingUserId,
              id,
              this.tenantId
            ]
          );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Collection not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);

    const selectResult = await this.query<CollectionSqlRow>(
      `${COLLECTION_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Collection not found');
    }

    return mapCollectionSqlRow(row);
  }

  /**
   * Deletes a collection and all of its requests and folders.
   *
   * @param id - Collection ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteCollection(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'collection', id);
    await this.query('DELETE FROM collections WHERE id = $1 AND tenant_id = $2', [
      id,
      this.tenantId
    ]);
  }

  /**
   * Finds a collection by stable identifier.
   *
   * @param id - Collection ID to look up.
   */
  async findCollectionById(id: string): Promise<CollectionRecord | null> {
    const result = await this.query<CollectionSqlRow>(
      `${COLLECTION_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapCollectionSqlRow(row) : null;
  }

  /**
   * Updates whether non-admin users may delete a collection.
   *
   * @param id - Collection ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the collection.
   * @param actingUserId - Admin user performing the update.
   */
  async setCollectionDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<CollectionRecord> {
    const updatedAt = new Date();
    const result = await this.query(
      `UPDATE collections
      SET deletion_locked = $1,
        updated_at = $2,
        updated_by_user_id = $3
      WHERE id = $4 AND tenant_id = $5`,
      [deletionLocked, updatedAt, actingUserId, id, this.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Collection not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);

    const selectResult = await this.query<CollectionSqlRow>(
      `${COLLECTION_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Collection not found');
    }

    return mapCollectionSqlRow(row);
  }

  /**
   * Lists all environments ordered by name.
   */
  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const result = await this.query<EnvironmentSqlRow>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = $1 ORDER BY name ASC`,
      [this.tenantId]
    );
    return result.rows.map(mapEnvironmentSqlRow);
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @param actingUserId - User performing the create action.
   */
  async createEnvironment(name: string, actingUserId: string): Promise<EnvironmentRecord> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const id = randomUUID();
    const now = new Date();

    const result = await this.query<EnvironmentSqlRow>(
      `INSERT INTO environments (
        id,
        tenant_id,
        name,
        variables,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, '[]', $4, $5, $6, $7)
      RETURNING ${ENVIRONMENT_SELECT_COLUMNS}`,
      [id, this.tenantId, trimmedName, now, now, actingUserId, actingUserId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Environment not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'environment', id);

    return mapEnvironmentSqlRow(row);
  }

  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param actingUserId - User performing the update action.
   * @param marker - Optional sidebar marker; omit to leave unchanged.
   * @param parentUuid - Parent environment id; `null` clears; omit to leave unchanged.
   */
  async updateEnvironment(
    id: string,
    name: string,
    variables: Variable[],
    actingUserId: string,
    marker?: string | null,
    parentUuid?: string | null
  ): Promise<EnvironmentRecord> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const updatedAt = new Date();
    const setClauses = [
      'name = $1',
      'variables = $2',
      'updated_at = $3',
      'updated_by_user_id = $4'
    ];
    const params: unknown[] = [trimmedName, JSON.stringify(variables), updatedAt, actingUserId];

    if (marker !== undefined) {
      params.push(serializeSidebarMarker(marker));
      setClauses.push(`marker = $${params.length}`);
    }
    if (parentUuid !== undefined) {
      params.push(parentUuid?.trim() || null);
      setClauses.push(`parent_uuid = $${params.length}`);
    }
    params.push(id);

    params.push(this.tenantId);
    const result = await this.query(
      `UPDATE environments
      SET ${setClauses.join(',\n        ')}
      WHERE id = $${params.length - 1} AND tenant_id = $${params.length}`,
      params
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Environment not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);

    const selectResult = await this.query<EnvironmentSqlRow>(
      `${ENVIRONMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Environment not found');
    }

    return mapEnvironmentSqlRow(row);
  }

  /**
   * Deletes an environment and orphans any direct children (clears their parent_uuid).
   *
   * @param id - Environment ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteEnvironment(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'environment', id);
    await this.query(
      'UPDATE environments SET parent_uuid = NULL WHERE parent_uuid = $1 AND tenant_id = $2',
      [id, this.tenantId]
    );
    await this.query('DELETE FROM environments WHERE id = $1 AND tenant_id = $2', [
      id,
      this.tenantId
    ]);
  }

  /**
   * Finds an environment by stable identifier.
   *
   * @param id - Environment ID to look up.
   */
  async findEnvironmentById(id: string): Promise<EnvironmentRecord | null> {
    const result = await this.query<EnvironmentSqlRow>(
      `${ENVIRONMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapEnvironmentSqlRow(row) : null;
  }

  /**
   * Updates whether non-admin users may delete an environment.
   *
   * @param id - Environment ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the environment.
   * @param actingUserId - Admin user performing the update.
   */
  async setEnvironmentDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<EnvironmentRecord> {
    const updatedAt = new Date();
    const result = await this.query(
      `UPDATE environments
      SET deletion_locked = $1,
        updated_at = $2,
        updated_by_user_id = $3
      WHERE id = $4 AND tenant_id = $5`,
      [deletionLocked, updatedAt, actingUserId, id, this.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Environment not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);

    const selectResult = await this.query<EnvironmentSqlRow>(
      `${ENVIRONMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Environment not found');
    }

    return mapEnvironmentSqlRow(row);
  }

  /**
   * Lists all snippets ordered by sort order then name.
   */
  async listSnippets(): Promise<SnippetRecord[]> {
    const result = await this.query<SnippetSqlRow>(
      `${SNIPPET_SELECT} WHERE tenant_id = $1 ORDER BY sort_order ASC, name ASC`,
      [this.tenantId]
    );
    return result.rows.map(mapSnippetSqlRow);
  }

  /**
   * Creates a new snippet with the given fields.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source for the snippet.
   * @param scope - Execution scope for the snippet.
   * @param actingUserId - User performing the create action.
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope,
    actingUserId: string
  ): Promise<SnippetRecord> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const id = randomUUID();
    const now = new Date();
    const maxResult = await this.query<{ max_order: number | null }>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets WHERE tenant_id = $1',
      [this.tenantId]
    );
    const maxOrder = maxResult.rows[0]?.max_order ?? -1;

    const result = await this.query<SnippetSqlRow>(
      `INSERT INTO snippets (
        id,
        tenant_id,
        name,
        code,
        scope,
        sort_order,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${SNIPPET_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        trimmedName,
        code,
        scope,
        maxOrder + 1,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Snippet not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'snippet', id);

    return mapSnippetSqlRow(row);
  }

  /**
   * Updates a snippet's name, code, and scope. Sort order is left unchanged.
   *
   * @param actingUserId - User performing the update action.
   */
  async updateSnippet(
    id: string,
    name: string,
    code: string,
    scope: SnippetScope,
    actingUserId: string
  ): Promise<SnippetRecord> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const updatedAt = new Date();
    const result = await this.query(
      `UPDATE snippets
      SET name = $1,
        code = $2,
        scope = $3,
        updated_at = $4,
        updated_by_user_id = $5
      WHERE id = $6 AND tenant_id = $7`,
      [trimmedName, code, scope, updatedAt, actingUserId, id, this.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Snippet not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);

    const selectResult = await this.query<SnippetSqlRow>(
      `${SNIPPET_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Snippet not found');
    }

    return mapSnippetSqlRow(row);
  }

  /**
   * Deletes a snippet.
   *
   * @param id - Snippet ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteSnippet(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'snippet', id);
    await this.query('DELETE FROM snippets WHERE id = $1 AND tenant_id = $2', [id, this.tenantId]);
  }

  /**
   * Finds a snippet by stable identifier.
   *
   * @param id - Snippet ID to look up.
   */
  async findSnippetById(id: string): Promise<SnippetRecord | null> {
    const result = await this.query<SnippetSqlRow>(
      `${SNIPPET_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapSnippetSqlRow(row) : null;
  }

  /**
   * Updates whether non-admin users may delete a snippet.
   *
   * @param id - Snippet ID to update.
   * @param deletionLocked - When true, user-role tokens cannot delete the snippet.
   * @param actingUserId - Admin user performing the update.
   */
  async setSnippetDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<SnippetRecord> {
    const updatedAt = new Date();
    const result = await this.query(
      `UPDATE snippets
      SET deletion_locked = $1,
        updated_at = $2,
        updated_by_user_id = $3
      WHERE id = $4 AND tenant_id = $5`,
      [deletionLocked, updatedAt, actingUserId, id, this.tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Snippet not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);

    const selectResult = await this.query<SnippetSqlRow>(
      `${SNIPPET_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = selectResult.rows[0];
    if (!row) {
      throw new Error('Snippet not found');
    }

    return mapSnippetSqlRow(row);
  }

  /**
   * Lists live servers ordered by name.
   */
  async listLiveServers(): Promise<LiveServerRecord[]> {
    return this.listPayloadEntities('live_servers', mapLiveServerSqlRow);
  }

  /**
   * Creates a live server.
   */
  async createLiveServer(
    input: CreateLiveServerRecordInput,
    actingUserId: string
  ): Promise<LiveServerRecord> {
    return this.createPayloadEntity(
      'live_servers',
      'live_server',
      input,
      actingUserId,
      mapLiveServerSqlRow
    );
  }

  /**
   * Replaces a live server.
   */
  async updateLiveServer(
    id: string,
    input: UpdateLiveServerRecordInput,
    actingUserId: string
  ): Promise<LiveServerRecord> {
    return this.updatePayloadEntity(
      'live_servers',
      'live_server',
      id,
      input,
      actingUserId,
      mapLiveServerSqlRow
    );
  }

  /**
   * Deletes a live server.
   */
  async deleteLiveServer(id: string, actingUserId: string): Promise<void> {
    await this.deletePayloadEntity('live_servers', 'live_server', id, actingUserId);
  }

  /**
   * Finds a live server by id.
   */
  async findLiveServerById(id: string): Promise<LiveServerRecord | null> {
    return this.findPayloadEntity('live_servers', id, mapLiveServerSqlRow);
  }

  /**
   * Updates a live server deletion lock.
   */
  async setLiveServerDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<LiveServerRecord> {
    return this.lockPayloadEntity(
      'live_servers',
      'live_server',
      id,
      deletionLocked,
      actingUserId,
      mapLiveServerSqlRow
    );
  }

  /**
   * Lists live pages ordered by name.
   */
  async listLivePages(): Promise<LivePageRecord[]> {
    return this.listPayloadEntities('live_pages', mapLivePageSqlRow);
  }

  /**
   * Creates a live page.
   */
  async createLivePage(
    input: CreateLivePageRecordInput,
    actingUserId: string
  ): Promise<LivePageRecord> {
    return this.createPayloadEntity(
      'live_pages',
      'live_page',
      input,
      actingUserId,
      mapLivePageSqlRow
    );
  }

  /**
   * Replaces a live page.
   */
  async updateLivePage(
    id: string,
    input: UpdateLivePageRecordInput,
    actingUserId: string
  ): Promise<LivePageRecord> {
    return this.updatePayloadEntity(
      'live_pages',
      'live_page',
      id,
      input,
      actingUserId,
      mapLivePageSqlRow
    );
  }

  /**
   * Deletes a live page.
   */
  async deleteLivePage(id: string, actingUserId: string): Promise<void> {
    await this.deletePayloadEntity('live_pages', 'live_page', id, actingUserId);
  }

  /**
   * Finds a live page by id.
   */
  async findLivePageById(id: string): Promise<LivePageRecord | null> {
    return this.findPayloadEntity('live_pages', id, mapLivePageSqlRow);
  }

  /**
   * Updates a live page deletion lock.
   */
  async setLivePageDeletionLocked(
    id: string,
    deletionLocked: boolean,
    actingUserId: string
  ): Promise<LivePageRecord> {
    return this.lockPayloadEntity(
      'live_pages',
      'live_page',
      id,
      deletionLocked,
      actingUserId,
      mapLivePageSqlRow
    );
  }

  /**
   * Lists rows from one of the two fixed payload entity tables.
   */
  private async listPayloadEntities<T>(
    table: 'live_servers' | 'live_pages',
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T[]> {
    const result = await this.query<PayloadEntitySqlRow>(
      `SELECT ${PAYLOAD_ENTITY_SELECT_COLUMNS} FROM ${table} WHERE tenant_id = $1 ORDER BY name ASC`,
      [this.tenantId]
    );
    return result.rows.map(mapper);
  }

  /**
   * Inserts a JSON-payload entity and records its audit entry.
   */
  private async createPayloadEntity<T>(
    table: 'live_servers' | 'live_pages',
    entityType: 'live_server' | 'live_page',
    input: CreateLiveServerRecordInput,
    actingUserId: string,
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T> {
    const id = randomUUID();
    const now = new Date();
    const name = trimRequiredName(input.name, 'Entity name');
    const result = await this.query<PayloadEntitySqlRow>(
      `INSERT INTO ${table} (id, tenant_id, name, payload, created_at, updated_at, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${PAYLOAD_ENTITY_SELECT_COLUMNS}`,
      [id, this.tenantId, name, JSON.stringify(input.payload), now, now, actingUserId, actingUserId]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Entity not found after insert');
    await this.recordAuditEntry(actingUserId, 'create', entityType, id);
    return mapper(row);
  }

  /**
   * Replaces the name and payload of a JSON-payload entity.
   */
  private async updatePayloadEntity<T>(
    table: 'live_servers' | 'live_pages',
    entityType: 'live_server' | 'live_page',
    id: string,
    input: UpdateLiveServerRecordInput,
    actingUserId: string,
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T> {
    const result = await this.query<PayloadEntitySqlRow>(
      `UPDATE ${table} SET name = $1, payload = $2, updated_at = $3, updated_by_user_id = $4
       WHERE id = $5 AND tenant_id = $6 RETURNING ${PAYLOAD_ENTITY_SELECT_COLUMNS}`,
      [
        trimRequiredName(input.name, 'Entity name'),
        JSON.stringify(input.payload),
        new Date(),
        actingUserId,
        id,
        this.tenantId
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Entity not found');
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    return mapper(row);
  }

  /**
   * Deletes a JSON-payload entity and records its audit entry.
   */
  private async deletePayloadEntity(
    table: 'live_servers' | 'live_pages',
    entityType: 'live_server' | 'live_page',
    id: string,
    actingUserId: string
  ): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', entityType, id);
    await this.query(`DELETE FROM ${table} WHERE id = $1 AND tenant_id = $2`, [id, this.tenantId]);
  }

  /**
   * Finds one JSON-payload entity.
   */
  private async findPayloadEntity<T>(
    table: 'live_servers' | 'live_pages',
    id: string,
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T | null> {
    const result = await this.query<PayloadEntitySqlRow>(
      `SELECT ${PAYLOAD_ENTITY_SELECT_COLUMNS} FROM ${table} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    return result.rows[0] ? mapper(result.rows[0]) : null;
  }

  /**
   * Changes a JSON-payload entity deletion lock.
   */
  private async lockPayloadEntity<T>(
    table: 'live_servers' | 'live_pages',
    entityType: 'live_server' | 'live_page',
    id: string,
    deletionLocked: boolean,
    actingUserId: string,
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T> {
    const result = await this.query<PayloadEntitySqlRow>(
      `UPDATE ${table} SET deletion_locked = $1, updated_at = $2, updated_by_user_id = $3
       WHERE id = $4 AND tenant_id = $5 RETURNING ${PAYLOAD_ENTITY_SELECT_COLUMNS}`,
      [deletionLocked, new Date(), actingUserId, id, this.tenantId]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Entity not found');
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    return mapper(row);
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const result = await this.query<RequestSqlRow>(
      `${REQUEST_SELECT} WHERE collection_id = $1 AND tenant_id = $2 ORDER BY sort_order ASC, name ASC`,
      [collectionId, this.tenantId]
    );
    return result.rows.map(mapRequestSqlRow);
  }

  /**
   * Finds a saved request by id.
   *
   * @param id - Request identifier to look up.
   */
  async findRequestById(id: string): Promise<SavedRequestRecord | null> {
    const result = await this.query<RequestSqlRow>(
      `${REQUEST_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapRequestSqlRow(row) : null;
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @param actingUserId - User performing the save action.
   */
  async saveRequest(input: SaveRequestInput, actingUserId: string): Promise<SavedRequestRecord> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const headers = JSON.stringify(input.headers);
    const params = JSON.stringify(input.params);
    const auth = JSON.stringify(input.auth);
    const protocol = input.protocol === 'sse' ? 'sse' : 'http';
    const folderId = input.folderId ?? null;
    const serializedMarker = serializeSidebarMarker(input.marker ?? null);
    const now = new Date();

    if (folderId != null) {
      const folderResult = await this.query<{ collection_id: string }>(
        'SELECT collection_id FROM folders WHERE id = $1 AND tenant_id = $2',
        [folderId, this.tenantId]
      );
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result = await this.query(
        `UPDATE requests SET
          collection_id = $1,
          folder_id = $2,
          name = $3,
          method = $4,
          protocol = $5,
          url = $6,
          headers = $7,
          params = $8,
          auth = $9,
          body = $10,
          body_type = $11,
          pre_request_script = $12,
          post_request_script = $13,
          comment = $14,
          marker = $15,
          updated_at = $16,
          updated_by_user_id = $17
        WHERE id = $18 AND tenant_id = $19`,
        [
          input.collectionId,
          folderId,
          trimmedName,
          input.method,
          protocol,
          input.url,
          headers,
          params,
          auth,
          input.body,
          input.bodyType,
          input.preRequestScript,
          input.postRequestScript,
          input.comment,
          serializedMarker,
          now,
          actingUserId,
          input.id,
          this.tenantId
        ]
      );

      if ((result.rowCount ?? 0) > 0) {
        await this.recordAuditEntry(actingUserId, 'update', 'request', input.id);

        const selectResult = await this.query<RequestSqlRow>(
          `${REQUEST_SELECT} WHERE id = $1 AND tenant_id = $2`,
          [input.id, this.tenantId]
        );
        const row = selectResult.rows[0];
        if (row) {
          return mapRequestSqlRow(row);
        }
      }
    }

    const maxResult = await this.query<{ max_order: number | null }>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE collection_id = $1
         AND tenant_id = $2
         AND (($3::text IS NULL AND folder_id IS NULL) OR folder_id = $3)`,
      [input.collectionId, this.tenantId, folderId]
    );
    const maxOrder = maxResult.rows[0]?.max_order ?? -1;
    const id = randomUUID();

    const result = await this.query<RequestSqlRow>(
      `INSERT INTO requests (
        id,
        tenant_id,
        collection_id,
        folder_id,
        name,
        method,
        protocol,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        marker,
        sort_order,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING ${REQUEST_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        input.collectionId,
        folderId,
        trimmedName,
        input.method,
        protocol,
        input.url,
        headers,
        params,
        auth,
        input.body,
        input.bodyType,
        input.preRequestScript,
        input.postRequestScript,
        input.comment,
        serializedMarker,
        maxOrder + 1,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Request not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'request', id);

    return mapRequestSqlRow(row);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteRequest(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'request', id);
    await this.query('DELETE FROM requests WHERE id = $1 AND tenant_id = $2', [id, this.tenantId]);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listFolders(collectionId: string): Promise<FolderRecord[]> {
    const result = await this.query<FolderSqlRow>(
      `${FOLDER_SELECT} WHERE collection_id = $1 AND tenant_id = $2 ORDER BY sort_order ASC, name ASC`,
      [collectionId, this.tenantId]
    );
    return result.rows.map(mapFolderSqlRow);
  }

  /**
   * Finds a folder by id.
   *
   * @param id - Folder identifier to look up.
   */
  async findFolderById(id: string): Promise<FolderRecord | null> {
    const result = await this.query<FolderSqlRow>(
      `${FOLDER_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapFolderSqlRow(row) : null;
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @param actingUserId - User performing the create action.
   */
  async createFolder(
    collectionId: string,
    name: string,
    actingUserId: string,
    parentFolderId: string | null = null
  ): Promise<FolderRecord> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    if (parentFolderId != null) {
      const parent = await this.findFolderById(parentFolderId);
      if (!parent || parent.collectionId !== collectionId) {
        throw new Error('Parent folder not found in collection');
      }
    }
    const id = randomUUID();
    const now = new Date();
    const maxResult = await this.query<{ max_order: number | null }>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order
       FROM folders
       WHERE collection_id = $1 AND tenant_id = $2 AND parent_folder_id IS NOT DISTINCT FROM $3`,
      [collectionId, this.tenantId, parentFolderId]
    );
    const maxOrder = maxResult.rows[0]?.max_order ?? -1;

    const result = await this.query<FolderSqlRow>(
      `INSERT INTO folders (
        id,
        tenant_id,
        collection_id,
        parent_folder_id,
        name,
        sort_order,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${FOLDER_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        collectionId,
        parentFolderId,
        trimmedName,
        maxOrder + 1,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Folder not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'folder', id);

    return mapFolderSqlRow(row);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @param actingUserId - User performing the rename action.
   */
  async renameFolder(
    id: string,
    name: string,
    actingUserId: string,
    marker?: string | null
  ): Promise<FolderRecord> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const updatedAt = new Date();
    const result =
      marker !== undefined
        ? await this.query<FolderSqlRow>(
            `UPDATE folders
      SET name = $1,
        updated_at = $2,
        updated_by_user_id = $3,
        marker = $4
      WHERE id = $5 AND tenant_id = $6
      RETURNING ${FOLDER_SELECT_COLUMNS}`,
            [
              trimmedName,
              updatedAt,
              actingUserId,
              serializeSidebarMarker(marker),
              id,
              this.tenantId
            ]
          )
        : await this.query<FolderSqlRow>(
            `UPDATE folders
      SET name = $1,
        updated_at = $2,
        updated_by_user_id = $3
      WHERE id = $4 AND tenant_id = $5
      RETURNING ${FOLDER_SELECT_COLUMNS}`,
            [trimmedName, updatedAt, actingUserId, id, this.tenantId]
          );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Folder not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'folder', id);

    return mapFolderSqlRow(row);
  }

  /**
   * Deletes a folder and its descendants.
   *
   * @param id - Folder ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteFolder(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'folder', id);

    await this.query('DELETE FROM folders WHERE id = $1 AND tenant_id = $2', [id, this.tenantId]);
  }

  /**
   * Moves a folder to a new parent and optional sibling position.
   *
   * @param id - Folder ID to move.
   * @param parentFolderId - Destination parent, or null for collection root.
   * @param sortOrder - Optional zero-based destination sibling index.
   * @param actingUserId - User performing the move action.
   */
  async moveFolder(
    id: string,
    parentFolderId: string | null,
    sortOrder: number | undefined,
    actingUserId: string
  ): Promise<FolderRecord> {
    const folder = await this.findFolderById(id);
    if (!folder) {
      throw new Error('Folder not found');
    }
    const folders = await this.listFolders(folder.collectionId);
    if (parentFolderId != null) {
      const parent = folders.find((entry) => entry.id === parentFolderId);
      if (!parent) {
        throw new Error('Parent folder not found in collection');
      }
      let ancestor: FolderRecord | undefined = parent;
      while (ancestor) {
        if (ancestor.id === id) {
          throw new Error('Cannot move a folder inside itself or its descendants');
        }
        ancestor =
          ancestor.parentFolderId == null
            ? undefined
            : folders.find((entry) => entry.id === ancestor?.parentFolderId);
      }
    }

    const siblings = folders
      .filter((entry) => entry.id !== id && entry.parentFolderId === parentFolderId)
      .sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      );
    const index = Math.max(0, Math.min(sortOrder ?? siblings.length, siblings.length));
    siblings.splice(index, 0, { ...folder, parentFolderId });

    const updatedAt = new Date();
    await this.query(
      `UPDATE folders SET parent_folder_id = $1, updated_at = $2, updated_by_user_id = $3
       WHERE id = $4 AND tenant_id = $5`,
      [parentFolderId, updatedAt, actingUserId, id, this.tenantId]
    );
    await this.reorderFolders(
      folder.collectionId,
      parentFolderId,
      siblings.map((entry) => entry.id),
      actingUserId
    );
    const moved = await this.findFolderById(id);
    if (!moved) {
      throw new Error('Folder not found after move');
    }
    return moved;
  }

  /**
   * Reorders sibling folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   * @param actingUserId - User performing the reorder action.
   */
  async reorderFolders(
    collectionId: string,
    parentFolderId: string | null,
    orderedFolderIds: string[],
    actingUserId: string
  ): Promise<void> {
    const client = await this.requirePool().connect();
    const updatedAt = new Date();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedFolderIds.length; index++) {
        await client.query(
          `UPDATE folders
          SET sort_order = $1,
            updated_at = $2,
            updated_by_user_id = $3
          WHERE id = $4
            AND collection_id = $5
            AND tenant_id = $6
            AND parent_folder_id IS NOT DISTINCT FROM $7`,
          [
            index,
            updatedAt,
            actingUserId,
            orderedFolderIds[index],
            collectionId,
            this.tenantId,
            parentFolderId
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'reorder', 'folder', collectionId, {
      parentFolderId,
      orderedFolderIds
    });
  }

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param actingUserId - User performing the reorder action.
   */
  async reorderRequests(
    collectionId: string,
    folderId: string | null,
    orderedRequestIds: string[],
    actingUserId: string
  ): Promise<void> {
    const client = await this.requirePool().connect();
    const updatedAt = new Date();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedRequestIds.length; index++) {
        await client.query(
          `UPDATE requests
          SET sort_order = $1,
            folder_id = $2,
            updated_at = $3,
            updated_by_user_id = $4
          WHERE id = $5 AND collection_id = $6 AND tenant_id = $7`,
          [
            index,
            folderId,
            updatedAt,
            actingUserId,
            orderedRequestIds[index],
            collectionId,
            this.tenantId
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'reorder', 'request', collectionId, {
      folderId,
      orderedRequestIds
    });
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param actingUserId - User performing the move action.
   */
  async moveRequest(
    requestId: string,
    folderId: string | null,
    index: number,
    actingUserId: string
  ): Promise<void> {
    const client = await this.requirePool().connect();
    const updatedAt = new Date();

    /**
     * Lists request ids in a container ordered for reindexing.
     *
     * @param collectionId - Collection to query.
     * @param targetFolderId - Folder id or null for collection root.
     */
    const listInContainer = async (
      collectionId: string,
      targetFolderId: string | null
    ): Promise<string[]> => {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM requests WHERE collection_id = $1
         AND tenant_id = $2
         AND (($3::text IS NULL AND folder_id IS NULL) OR folder_id = $3)
         ORDER BY sort_order ASC, name ASC`,
        [collectionId, this.tenantId, targetFolderId]
      );
      return result.rows.map((row) => row.id);
    };

    /**
     * Rewrites sort_order and folder_id for a container's request list.
     *
     * @param targetFolderId - Folder id or null for collection root.
     * @param orderedIds - Request ids in desired order.
     */
    const reindexContainer = async (
      targetFolderId: string | null,
      orderedIds: string[]
    ): Promise<void> => {
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        await client.query(
          `UPDATE requests
          SET sort_order = $1,
            folder_id = $2,
            updated_at = $3,
            updated_by_user_id = $4
          WHERE id = $5 AND tenant_id = $6`,
          [sortIndex, targetFolderId, updatedAt, actingUserId, orderedIds[sortIndex], this.tenantId]
        );
      }
    };

    try {
      await client.query('BEGIN');

      const requestResult = await client.query<RequestSqlRow>(
        `${REQUEST_SELECT} WHERE id = $1 AND tenant_id = $2`,
        [requestId, this.tenantId]
      );
      const requestRow = requestResult.rows[0];
      if (!requestRow) {
        throw new Error('Request not found');
      }

      const request = mapRequestSqlRow(requestRow);
      const collectionId = request.collectionId;
      const oldFolderId = request.folderId;

      if (folderId != null) {
        const folderResult = await client.query<{ collection_id: string }>(
          'SELECT collection_id FROM folders WHERE id = $1 AND tenant_id = $2',
          [folderId, this.tenantId]
        );
        const folderRow = folderResult.rows[0];
        if (!folderRow || folderRow.collection_id !== collectionId) {
          throw new Error('Folder not found');
        }
      }

      if (oldFolderId === folderId) {
        const siblings = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== requestId
        );
        siblings.splice(index, 0, requestId);
        await reindexContainer(folderId, siblings);
      } else {
        const oldIds = (await listInContainer(collectionId, oldFolderId)).filter(
          (id) => id !== requestId
        );
        await reindexContainer(oldFolderId, oldIds);

        const newIds = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== requestId
        );
        newIds.splice(index, 0, requestId);
        await reindexContainer(folderId, newIds);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'move', 'request', requestId, {
      folderId,
      index
    });
  }

  /**
   * Lists all documents in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listDocuments(collectionId: string): Promise<DocumentRecord[]> {
    const result = await this.query<DocumentSqlRow>(
      `${DOCUMENT_SELECT} WHERE collection_id = $1 AND tenant_id = $2 ORDER BY sort_order ASC, name ASC`,
      [collectionId, this.tenantId]
    );
    return result.rows.map(mapDocumentSqlRow);
  }

  /**
   * Finds a document by id.
   *
   * @param id - Document identifier to look up.
   */
  async findDocumentById(id: string): Promise<DocumentRecord | null> {
    const result = await this.query<DocumentSqlRow>(
      `${DOCUMENT_SELECT} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapDocumentSqlRow(row) : null;
  }

  /**
   * Inserts a new document or updates an existing one.
   *
   * @param input - Document fields to persist.
   * @param actingUserId - User performing the save action.
   */
  async saveDocument(input: SaveDocumentInput, actingUserId: string): Promise<DocumentRecord> {
    const trimmedName = trimRequiredName(input.name, 'Document name');
    const folderId = input.folderId ?? null;
    const serializedMarker = serializeSidebarMarker(input.marker ?? null);
    const now = new Date();

    if (folderId != null) {
      const folderResult = await this.query<{ collection_id: string }>(
        'SELECT collection_id FROM folders WHERE id = $1 AND tenant_id = $2',
        [folderId, this.tenantId]
      );
      const folderRow = folderResult.rows[0];
      if (!folderRow || folderRow.collection_id !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result = await this.query(
        `UPDATE documents SET
          collection_id = $1,
          folder_id = $2,
          name = $3,
          content = $4,
          marker = $5,
          updated_at = $6,
          updated_by_user_id = $7
        WHERE id = $8 AND tenant_id = $9`,
        [
          input.collectionId,
          folderId,
          trimmedName,
          input.content,
          serializedMarker,
          now,
          actingUserId,
          input.id,
          this.tenantId
        ]
      );

      if ((result.rowCount ?? 0) > 0) {
        await this.recordAuditEntry(actingUserId, 'update', 'document', input.id);

        const selectResult = await this.query<DocumentSqlRow>(
          `${DOCUMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
          [input.id, this.tenantId]
        );
        const row = selectResult.rows[0];
        if (row) {
          return mapDocumentSqlRow(row);
        }
      }
    }

    const maxResult = await this.query<{ max_order: number | null }>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM documents
       WHERE collection_id = $1
         AND tenant_id = $2
         AND (($3::text IS NULL AND folder_id IS NULL) OR folder_id = $3)`,
      [input.collectionId, this.tenantId, folderId]
    );
    const maxOrder = maxResult.rows[0]?.max_order ?? -1;
    const id = randomUUID();

    const result = await this.query<DocumentSqlRow>(
      `INSERT INTO documents (
        id,
        tenant_id,
        collection_id,
        folder_id,
        name,
        content,
        marker,
        sort_order,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${DOCUMENT_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        input.collectionId,
        folderId,
        trimmedName,
        input.content,
        serializedMarker,
        maxOrder + 1,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Document not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'document', id);

    return mapDocumentSqlRow(row);
  }

  /**
   * Deletes a document by ID.
   *
   * @param id - Document ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteDocument(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'document', id);
    await this.query('DELETE FROM documents WHERE id = $1 AND tenant_id = $2', [id, this.tenantId]);
  }

  /**
   * Reorders documents within a folder or at collection root.
   *
   * @param actingUserId - User performing the reorder action.
   */
  async reorderDocuments(
    collectionId: string,
    folderId: string | null,
    orderedDocumentIds: string[],
    actingUserId: string
  ): Promise<void> {
    const client = await this.requirePool().connect();
    const updatedAt = new Date();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < orderedDocumentIds.length; index++) {
        await client.query(
          `UPDATE documents
          SET sort_order = $1,
            folder_id = $2,
            updated_at = $3,
            updated_by_user_id = $4
          WHERE id = $5 AND collection_id = $6 AND tenant_id = $7`,
          [
            index,
            folderId,
            updatedAt,
            actingUserId,
            orderedDocumentIds[index],
            collectionId,
            this.tenantId
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'reorder', 'document', collectionId, {
      folderId,
      orderedDocumentIds
    });
  }

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param actingUserId - User performing the move action.
   */
  async moveDocument(
    documentId: string,
    folderId: string | null,
    index: number,
    actingUserId: string
  ): Promise<void> {
    const client = await this.requirePool().connect();
    const updatedAt = new Date();

    /**
     * Lists document ids in a container ordered for reindexing.
     *
     * @param collectionId - Collection to query.
     * @param targetFolderId - Folder id or null for collection root.
     */
    const listInContainer = async (
      collectionId: string,
      targetFolderId: string | null
    ): Promise<string[]> => {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM documents WHERE collection_id = $1
         AND tenant_id = $2
         AND (($3::text IS NULL AND folder_id IS NULL) OR folder_id = $3)
         ORDER BY sort_order ASC, name ASC`,
        [collectionId, this.tenantId, targetFolderId]
      );
      return result.rows.map((row) => row.id);
    };

    /**
     * Rewrites sort_order and folder_id for a container's document list.
     *
     * @param targetFolderId - Folder id or null for collection root.
     * @param orderedIds - Document ids in desired order.
     */
    const reindexContainer = async (
      targetFolderId: string | null,
      orderedIds: string[]
    ): Promise<void> => {
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        await client.query(
          `UPDATE documents
          SET sort_order = $1,
            folder_id = $2,
            updated_at = $3,
            updated_by_user_id = $4
          WHERE id = $5 AND tenant_id = $6`,
          [sortIndex, targetFolderId, updatedAt, actingUserId, orderedIds[sortIndex], this.tenantId]
        );
      }
    };

    try {
      await client.query('BEGIN');

      const documentResult = await client.query<DocumentSqlRow>(
        `${DOCUMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
        [documentId, this.tenantId]
      );
      const documentRow = documentResult.rows[0];
      if (!documentRow) {
        throw new Error('Document not found');
      }

      const document = mapDocumentSqlRow(documentRow);
      const collectionId = document.collectionId;
      const oldFolderId = document.folderId;

      if (folderId != null) {
        const folderResult = await client.query<{ collection_id: string }>(
          'SELECT collection_id FROM folders WHERE id = $1 AND tenant_id = $2',
          [folderId, this.tenantId]
        );
        const folderRow = folderResult.rows[0];
        if (!folderRow || folderRow.collection_id !== collectionId) {
          throw new Error('Folder not found');
        }
      }

      if (oldFolderId === folderId) {
        const siblings = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== documentId
        );
        siblings.splice(index, 0, documentId);
        await reindexContainer(folderId, siblings);
      } else {
        const oldIds = (await listInContainer(collectionId, oldFolderId)).filter(
          (id) => id !== documentId
        );
        await reindexContainer(oldFolderId, oldIds);

        const newIds = (await listInContainer(collectionId, folderId)).filter(
          (id) => id !== documentId
        );
        newIds.splice(index, 0, documentId);
        await reindexContainer(folderId, newIds);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.recordAuditEntry(actingUserId, 'move', 'document', documentId, {
      folderId,
      index
    });
  }

  /**
   * Returns monthly LLM usage for a user, or null when no usage has been recorded.
   *
   * @param userId - Owning user identifier.
   * @param period - UTC calendar month key (`YYYY-MM`).
   */
  async getLlmUsage(userId: string, period: string): Promise<LlmUsageRecord | null> {
    const result = await this.query<LlmUsageSqlRow>(
      `${LLM_USAGE_SELECT} WHERE user_id = $1 AND period = $2 AND tenant_id = $3 LIMIT 1`,
      [userId, period, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapLlmUsageSqlRow(row) : null;
  }

  /**
   * Atomically increments monthly LLM token usage for a user.
   *
   * @param userId - Owning user identifier.
   * @param period - UTC calendar month key (`YYYY-MM`).
   * @param promptTokens - Prompt tokens to add.
   * @param completionTokens - Completion tokens to add.
   */
  async addLlmUsage(
    userId: string,
    period: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<LlmUsageRecord> {
    const totalDelta = promptTokens + completionTokens;
    const now = new Date();
    const id = randomUUID();

    const result = await this.query<LlmUsageSqlRow>(
      `INSERT INTO llm_usage (
        id,
        tenant_id,
        user_id,
        period,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, user_id, period) DO UPDATE
      SET prompt_tokens = llm_usage.prompt_tokens + EXCLUDED.prompt_tokens,
        completion_tokens = llm_usage.completion_tokens + EXCLUDED.completion_tokens,
        total_tokens = llm_usage.total_tokens + EXCLUDED.total_tokens,
        updated_at = EXCLUDED.updated_at
      RETURNING ${LLM_USAGE_SELECT_COLUMNS}`,
      [id, this.tenantId, userId, period, promptTokens, completionTokens, totalDelta, now]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('LLM usage not found after upsert');
    }

    return mapLlmUsageSqlRow(row);
  }

  /**
   * Inserts a per-request LLM usage log entry.
   *
   * @param input - Usage details for one successful completion step.
   */
  async createLlmUsageLog(input: CreateLlmUsageLogInput): Promise<LlmUsageLogRecord> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.query<LlmUsageLogSqlRow>(
      `INSERT INTO llm_usage_log (
        id,
        tenant_id,
        user_id,
        api_token_id,
        period,
        model,
        provider,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        is_new_turn,
        had_tool_calls,
        message_count,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING ${LLM_USAGE_LOG_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        input.userId,
        input.apiTokenId,
        input.period,
        input.model,
        input.provider,
        input.promptTokens,
        input.completionTokens,
        input.totalTokens,
        input.isNewTurn,
        input.hadToolCalls,
        input.messageCount,
        now
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('LLM usage log not found after insert');
    }

    return mapLlmUsageLogSqlRow(row);
  }

  /**
   * Lists all per-request LLM usage log entries, newest first.
   */
  async listLlmUsageLogs(): Promise<LlmUsageLogRecord[]> {
    const result = await this.query<LlmUsageLogSqlRow>(
      `${LLM_USAGE_LOG_SELECT} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return result.rows.map(mapLlmUsageLogSqlRow);
  }

  /**
   * Lists run results saved by the given user, newest first.
   */
  async listRunResultsForUser(userId: string): Promise<RunResultRecord[]> {
    const result = await this.query<RunResultSqlRow>(
      `${RUN_RESULT_SELECT} WHERE created_by_user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [userId, this.tenantId]
    );
    return result.rows.map(mapRunResultSqlRow);
  }

  /**
   * Lists all run results for admin inspection, newest first.
   */
  async listAllRunResults(): Promise<RunResultRecord[]> {
    const result = await this.query<RunResultSqlRow>(
      `${RUN_RESULT_SELECT} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [this.tenantId]
    );
    return result.rows.map(mapRunResultSqlRow);
  }

  /**
   * Creates a standalone run result snapshot.
   */
  async createRunResult(
    input: CreateRunResultInput,
    actingUserId: string
  ): Promise<RunResultRecord> {
    const metadata = parseRunResultPayload(input.payload);
    const label = input.label?.trim() || buildDefaultRunResultLabel(metadata);
    const id = randomUUID();
    const now = new Date();

    const result = await this.query<RunResultSqlRow>(
      `INSERT INTO run_results (
        id,
        tenant_id,
        kind,
        label,
        collection_name,
        request_name,
        summary_passed,
        summary_failed,
        summary_skipped,
        payload,
        created_at,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${RUN_RESULT_SELECT_COLUMNS}`,
      [
        id,
        this.tenantId,
        metadata.kind,
        label,
        metadata.collectionName,
        metadata.requestName,
        metadata.summary.passed,
        metadata.summary.failed,
        metadata.summary.skipped,
        JSON.stringify(input.payload),
        now,
        actingUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Run result not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'run_result', id);
    return mapRunResultSqlRow(row);
  }

  /**
   * Finds a run result by id.
   */
  async findRunResultById(id: string): Promise<RunResultRecord | null> {
    const result = await this.query<RunResultSqlRow>(
      `${RUN_RESULT_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapRunResultSqlRow(row) : null;
  }

  /**
   * Deletes a run result by id.
   */
  async deleteRunResult(id: string, actingUserId: string): Promise<void> {
    const result = await this.query('DELETE FROM run_results WHERE id = $1 AND tenant_id = $2', [
      id,
      this.tenantId
    ]);
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Run result not found');
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'run_result', id);
  }

  /**
   * Creates a discussion comment on a target entity, enforcing tree placement rules.
   */
  async createDiscussionComment(
    input: CreateDiscussionCommentInput,
    actingUserId: string
  ): Promise<DiscussionCommentRecord> {
    const prepared = await prepareSqlDiscussionCommentInsert(input, actingUserId, (parentId) =>
      this.findDiscussionCommentById(parentId)
    );

    const result = await this.query<DiscussionCommentSqlRow>(
      `INSERT INTO discussion_comments (
        id,
        tenant_id,
        target_entity_type,
        target_entity_id,
        parent_comment_id,
        root_comment_id,
        depth,
        body,
        body_format,
        body_metadata,
        author_user_id,
        created_at,
        updated_at,
        tombstoned_at,
        tombstoned_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, NULL)
      RETURNING ${DISCUSSION_COMMENT_SELECT_COLUMNS}`,
      [
        prepared.id,
        this.tenantId,
        prepared.targetEntityType,
        prepared.targetEntityId,
        prepared.parentCommentId,
        prepared.rootCommentId,
        prepared.depth,
        prepared.body,
        prepared.bodyFormat,
        serializeDiscussionBodyMetadata(prepared.bodyMetadata),
        prepared.authorUserId,
        prepared.createdAt,
        prepared.updatedAt
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Discussion comment not found after insert');
    }

    await this.recordAuditEntry(actingUserId, 'create', 'discussion_comment', prepared.id);
    return mapDiscussionCommentSqlRow(row);
  }

  /**
   * Lists discussion comments for a target entity with cursor pagination.
   */
  async listDiscussionComments(
    options: ListDiscussionCommentsOptions
  ): Promise<ListDiscussionCommentsResult> {
    const limit = normalizeDiscussionListLimit(options.limit);
    const cursor = parseDiscussionListCursor(options.cursor);

    const result = await this.query<DiscussionCommentSqlRow>(
      `${DISCUSSION_COMMENT_SELECT}
      WHERE tenant_id = $1
        AND target_entity_type = $2
        AND target_entity_id = $3
        AND ($4::timestamptz IS NULL OR created_at > $4)
      ORDER BY created_at ASC
      LIMIT $5`,
      [this.tenantId, options.targetEntityType, options.targetEntityId, cursor, limit + 1]
    );

    return buildDiscussionListResult(result.rows, limit);
  }

  /**
   * Finds a discussion comment by id within the current tenant.
   */
  async findDiscussionCommentById(id: string): Promise<DiscussionCommentRecord | null> {
    const result = await this.query<DiscussionCommentSqlRow>(
      `${DISCUSSION_COMMENT_SELECT} WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId]
    );
    const row = result.rows[0];
    return row ? mapDiscussionCommentSqlRow(row) : null;
  }

  /**
   * Updates the body of an active discussion comment authored by the acting user.
   */
  async updateDiscussionComment(
    id: string,
    input: UpdateDiscussionCommentInput,
    actingUserId: string
  ): Promise<DiscussionCommentRecord> {
    const existing = await this.findDiscussionCommentById(id);
    if (!existing) {
      throw new DiscussionCommentNotFoundError();
    }

    assertDiscussionCommentEditable(existing, actingUserId);
    const normalized = normalizeDiscussionUpdateInput(input);
    const now = new Date();

    const result = await this.query<DiscussionCommentSqlRow>(
      `UPDATE discussion_comments
      SET body = $1,
        body_format = $2,
        body_metadata = $3,
        updated_at = $4
      WHERE id = $5 AND tenant_id = $6
      RETURNING ${DISCUSSION_COMMENT_SELECT_COLUMNS}`,
      [
        normalized.body,
        normalized.bodyFormat,
        serializeDiscussionBodyMetadata(normalized.bodyMetadata),
        now,
        id,
        this.tenantId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DiscussionCommentNotFoundError();
    }

    await this.recordAuditEntry(actingUserId, 'update', 'discussion_comment', id);
    return mapDiscussionCommentSqlRow(row);
  }

  /**
   * Tombstones a discussion comment while preserving child replies.
   */
  async tombstoneDiscussionComment(
    id: string,
    actingUserId: string
  ): Promise<DiscussionCommentRecord> {
    const existing = await this.findDiscussionCommentById(id);
    if (!existing) {
      throw new DiscussionCommentNotFoundError();
    }

    if (existing.tombstonedAt) {
      return existing;
    }

    const now = new Date();

    const result = await this.query<DiscussionCommentSqlRow>(
      `UPDATE discussion_comments
      SET body = '', updated_at = $1, tombstoned_at = $2, tombstoned_by_user_id = $3
      WHERE id = $4 AND tenant_id = $5
      RETURNING ${DISCUSSION_COMMENT_SELECT_COLUMNS}`,
      [now, now, actingUserId, id, this.tenantId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DiscussionCommentNotFoundError();
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'discussion_comment', id);
    return mapDiscussionCommentSqlRow(row);
  }

  /**
   * Creates one or more collaboration notices for eligible recipients.
   */
  async createNotices(inputs: CreateNoticeInput[]): Promise<NoticeRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const now = new Date();
    const records: NoticeRecord[] = [];

    for (const input of inputs) {
      const id = randomUUID();
      const result = await this.query<NoticeSqlRow>(
        `INSERT INTO notices (
          id,
          tenant_id,
          recipient_user_id,
          event_type,
          entity_type,
          entity_id,
          request_id,
          collection_id,
          folder_id,
          run_result_id,
          discussion_thread_id,
          discussion_comment_id,
          actor_user_id,
          created_at,
          read_at,
          display_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, $15)
        RETURNING ${NOTICE_SELECT_COLUMNS}`,
        [
          id,
          this.tenantId,
          input.recipientUserId,
          input.eventType,
          input.entityType,
          input.entityId,
          input.requestId ?? null,
          input.collectionId ?? null,
          input.folderId ?? null,
          input.runResultId ?? null,
          input.discussionThreadId ?? null,
          input.discussionCommentId ?? null,
          input.actorUserId,
          now,
          serializeNoticeDisplayMetadata(input.displayMetadata)
        ]
      );

      const row = result.rows[0];
      if (row) {
        records.push(mapNoticeSqlRow(row));
      }
    }

    return records;
  }

  /**
   * Lists notices for a recipient with cursor pagination (newest first).
   */
  async listNotices(options: ListNoticesOptions): Promise<ListNoticesResult> {
    const limit = normalizeNoticeListLimit(options.limit);
    const cursor = parseNoticeListCursor(options.cursor);

    const result = await this.query<NoticeSqlRow>(
      `${NOTICE_SELECT}
      WHERE tenant_id = $1
        AND recipient_user_id = $2
        AND ($3::timestamptz IS NULL OR created_at < $3)
      ORDER BY created_at DESC
      LIMIT $4`,
      [this.tenantId, options.recipientUserId, cursor, limit + 1]
    );

    return buildNoticeListResult(result.rows, limit);
  }

  /**
   * Counts unread notices for a recipient without loading the full feed.
   */
  async countUnreadNotices(recipientUserId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM notices
       WHERE tenant_id = $1 AND recipient_user_id = $2 AND read_at IS NULL`,
      [this.tenantId, recipientUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  /**
   * Marks one notice read for the authenticated recipient.
   */
  async markNoticeRead(noticeId: string, recipientUserId: string): Promise<NoticeRecord | null> {
    const now = new Date();
    const result = await this.query<NoticeSqlRow>(
      `UPDATE notices
       SET read_at = $1
       WHERE id = $2 AND tenant_id = $3 AND recipient_user_id = $4
       RETURNING ${NOTICE_SELECT_COLUMNS}`,
      [now, noticeId, this.tenantId, recipientUserId]
    );

    const row = result.rows[0];
    return row ? mapNoticeSqlRow(row) : null;
  }

  /**
   * Marks all unread notices read for a recipient.
   */
  async markAllNoticesRead(recipientUserId: string): Promise<number> {
    const now = new Date();
    const result = await this.query<{ count: string }>(
      `WITH updated AS (
         UPDATE notices
         SET read_at = $1
         WHERE tenant_id = $2 AND recipient_user_id = $3 AND read_at IS NULL
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM updated`,
      [now, this.tenantId, recipientUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  /**
   * Returns notification settings for a user, defaulting to `all` when unset.
   */
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettingsRecord> {
    const result = await this.query<{ level: NotificationLevel; updated_at: Date }>(
      `SELECT level, updated_at
       FROM user_notification_settings
       WHERE tenant_id = $1 AND user_id = $2`,
      [this.tenantId, userId]
    );

    const row = result.rows[0];
    if (row) {
      return {
        userId,
        level: row.level,
        updatedAt: row.updated_at
      };
    }

    return {
      userId,
      level: 'all',
      updatedAt: new Date(0)
    };
  }

  /**
   * Updates notification settings for a user account.
   */
  async updateUserNotificationSettings(
    userId: string,
    level: NotificationLevel
  ): Promise<UserNotificationSettingsRecord> {
    const now = new Date();
    await this.query(
      `INSERT INTO user_notification_settings (user_id, tenant_id, level, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET level = EXCLUDED.level, updated_at = EXCLUDED.updated_at`,
      [userId, this.tenantId, level, now]
    );

    return { userId, level, updatedAt: now };
  }

  /**
   * Subscribes a user to a discussion thread identified by its root comment id.
   */
  async subscribeDiscussionThread(
    userId: string,
    rootCommentId: string
  ): Promise<DiscussionThreadSubscriptionRecord> {
    const now = new Date();
    await this.query(
      `INSERT INTO discussion_thread_subscriptions (user_id, tenant_id, root_comment_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, root_comment_id) DO NOTHING`,
      [userId, this.tenantId, rootCommentId, now]
    );

    return { userId, rootCommentId, createdAt: now };
  }

  /**
   * Removes a user's subscription to a discussion thread.
   */
  async unsubscribeDiscussionThread(userId: string, rootCommentId: string): Promise<void> {
    await this.query(
      `DELETE FROM discussion_thread_subscriptions
       WHERE tenant_id = $1 AND user_id = $2 AND root_comment_id = $3`,
      [this.tenantId, userId, rootCommentId]
    );
  }

  /**
   * Returns true when the user is subscribed to a discussion thread.
   */
  async isSubscribedToDiscussionThread(userId: string, rootCommentId: string): Promise<boolean> {
    const result = await this.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM discussion_thread_subscriptions
         WHERE tenant_id = $1 AND user_id = $2 AND root_comment_id = $3
       ) AS exists`,
      [this.tenantId, userId, rootCommentId]
    );
    return result.rows[0]?.exists === true;
  }

  /**
   * Lists user ids subscribed to a discussion thread.
   */
  async listDiscussionThreadSubscribers(rootCommentId: string): Promise<string[]> {
    const result = await this.query<{ user_id: string }>(
      `SELECT user_id FROM discussion_thread_subscriptions
       WHERE tenant_id = $1 AND root_comment_id = $2`,
      [this.tenantId, rootCommentId]
    );
    return result.rows.map((row) => row.user_id);
  }

  /**
   * Returns the active pool or throws when connect has not been called.
   *
   * @returns Connected Postgres pool.
   * @throws {Error} When the database is not connected.
   */
  private requirePool(): pg.Pool {
    if (!this.pool) {
      throw new Error('Postgres database is not connected.');
    }

    return this.pool;
  }

  /**
   * Ensures the internal system user exists and caches its identifier.
   *
   * Inserts directly rather than calling {@link createUser} to avoid recursion
   * during migration bootstrap.
   */
  async ensureSystemUser(): Promise<void> {
    const existing = await this.findUserByName(SYSTEM_USER_NAME);
    if (existing) {
      this.systemUserId = existing.id;
      return;
    }

    const id = randomUUID();
    const now = new Date();
    const input = createSystemUserInput();

    await this.query(
      `INSERT INTO users (
        id,
        tenant_id,
        name,
        role,
        collection_access,
        environment_access,
        snippet_access,
        live_server_access,
        live_page_access,
        llm_access,
        llm_models,
        llm_monthly_token_limit,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        this.tenantId,
        SYSTEM_USER_NAME,
        input.role,
        serializeAccessList(input.collectionAccess),
        serializeAccessList(input.environmentAccess),
        serializeAccessList(input.snippetAccess),
        serializeAccessList(input.liveServerAccess),
        serializeAccessList(input.livePageAccess),
        false,
        serializeAccessList([]),
        null,
        now,
        now,
        id,
        id
      ]
    );

    this.systemUserId = id;
  }

  /**
   * Persists a single audit log entry for a mutating action.
   *
   * @param actingUserId - User performing the action.
   * @param action - CRUD or structural action performed.
   * @param entityType - Kind of entity affected.
   * @param entityId - Identifier of the affected entity.
   * @param metadata - Optional structured context for the action.
   */
  private async recordAuditEntry(
    actingUserId: string,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    metadata?: Record<string, unknown> | null
  ): Promise<void> {
    const userName = await resolveActingUserName(
      (userId) => this.findUserById(userId),
      actingUserId
    );
    const id = randomUUID();
    const now = new Date();

    await this.query(
      `INSERT INTO audit_log (
        id,
        tenant_id,
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        created_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        this.tenantId,
        actingUserId,
        userName,
        action,
        entityType,
        entityId,
        now,
        serializeAuditMetadata(metadata ?? null)
      ]
    );
  }

  /**
   * Executes a parameterized SQL statement against the active pool.
   *
   * @param sql - SQL statement with $1-style placeholders.
   * @param params - Bound parameter values.
   * @returns Query result from pg.
   */
  private async query<T extends pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<pg.QueryResult<T>> {
    return this.requirePool().query<T>(sql, params);
  }
}
