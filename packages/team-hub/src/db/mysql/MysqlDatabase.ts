import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
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
import { INVITATION_SELECT } from '#/db/mysql/invitationSql.js';
import { generateApiToken } from '#/server/auth/apiTokens.js';
import { resolveActingUserName } from '#/db/attribution.js';
import {
  mapAuditLogSqlRow,
  serializeAuditMetadata,
  type AuditLogSqlRow
} from '#/db/auditLogRows.js';
import { BOOTSTRAP_USER_NAME } from '#/db/bootstrapUsers.js';
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
import { MYSQL_DEFAULT_AUTH_JSON, MYSQL_MIGRATIONS } from '#/db/mysql/migrations.js';
import { mysqlConfigSchema } from '#/db/mysql/schemas.js';
import type { MysqlDatabaseConfig } from '#/db/mysql/types.js';
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
import { formatZodError } from '#/db/validation.js';
import { DEFAULT_TENANT_ID, isDefaultTenantId } from '#/config/multitenancyConfig.js';

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
const AUDIT_LOG_SELECT = `SELECT ${AUDIT_LOG_SELECT_COLUMNS} FROM audit_log`;
const LLM_USAGE_SELECT = `SELECT ${LLM_USAGE_SELECT_COLUMNS} FROM llm_usage`;
const LLM_USAGE_LOG_SELECT = `SELECT ${LLM_USAGE_LOG_SELECT_COLUMNS} FROM llm_usage_log`;

/**
 * MySQL-backed database implementation.
 */
export class MysqlDatabase implements IDatabase {
  /**
   * Active MySQL connection pool, or null when disconnected.
   */
  private pool: Pool | null = null;

  /**
   * Cached identifier of the internal system user, when provisioned during migration.
   */
  private systemUserId: string | null = null;

  /**
   * Tenant namespace for all entity queries on this database instance.
   *
   * Defaults to {@link DEFAULT_TENANT_ID}. Use {@link forTenant} to create
   * a scoped instance for a different tenant without opening a new connection.
   */
  private readonly tenantId: string;

  /**
   * When true, this instance owns the connection pool and will close it on disconnect.
   *
   * Set to false by {@link forTenant} so shared pool instances remain open when
   * a tenant-scoped handle is discarded.
   */
  private readonly ownsPool: boolean;

  /**
   * Creates a MySQL database instance from validated config.
   *
   * @param config - Parsed MySQL connection settings.
   * @param tenantId - Optional tenant namespace; defaults to {@link DEFAULT_TENANT_ID}.
   * @param ownsPool - Whether this instance owns the pool; defaults to true.
   */
  constructor(
    private readonly config: MysqlDatabaseConfig,
    tenantId?: string,
    ownsPool?: boolean
  ) {
    this.tenantId = tenantId ?? DEFAULT_TENANT_ID;
    this.ownsPool = ownsPool ?? true;
  }

  /**
   * Validates raw config and constructs a {@link MysqlDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured MySQL database instance.
   * @throws {Error} When config fails MySQL-specific validation.
   */
  static fromConfig(config: unknown): MysqlDatabase {
    const parsed = mysqlConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new MysqlDatabase({
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      password: parsed.data.password,
      database: parsed.data.database
    });
  }

  /**
   * Opens a MySQL connection pool and verifies connectivity with a ping.
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    this.pool = pool;
  }

  /**
   * Closes the MySQL connection pool and releases resources.
   *
   * Only closes the pool when this instance owns it; tenant-scoped handles
   * created by {@link forTenant} leave the shared pool open.
   */
  async disconnect(): Promise<void> {
    if (!this.pool || !this.ownsPool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
  }

  /**
   * Creates required tables when they do not already exist.
   */
  async migrate(): Promise<void> {
    for (const sql of MYSQL_MIGRATIONS) {
      await this.executeStatement(sql);
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
    const rows = await this.queryRows<
      { id: string; name: string; tenant_id: string } & RowDataPacket
    >(
      `SELECT id, name, tenant_id FROM users WHERE avatar_initials IS NULL OR avatar_color IS NULL`
    );

    for (const row of rows) {
      const defaults = defaultAvatarPresentation(row.name, row.id);
      await this.executeStatement(
        `UPDATE users SET avatar_initials = ?, avatar_color = ? WHERE id = ? AND tenant_id = ?`,
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
   * Returns the tenant namespace for this database instance.
   *
   * All entity queries are scoped to this tenant. Use {@link forTenant} to
   * create a handle for a different tenant without opening a new connection.
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Creates a tenant-scoped database handle that shares the same connection pool.
   *
   * The returned instance uses the same pool as the parent but operates in a
   * different tenant namespace. Calling disconnect on the tenant-scoped handle
   * does not close the shared pool.
   *
   * @param tenantId - Tenant identifier for the new handle.
   * @returns Database instance scoped to the given tenant.
   */
  forTenant(tenantId: string): IDatabase {
    const scoped = new MysqlDatabase(this.config, tenantId, false);
    scoped.pool = this.pool;
    scoped.systemUserId = this.systemUserId;
    return scoped;
  }

  /**
   * Ensures the default tenant exists in the tenants table.
   *
   * Inserts the reserved {@link DEFAULT_TENANT_ID} tenant when it does not
   * already exist. Called during migration before other tenant operations.
   */
  async ensureDefaultTenant(): Promise<void> {
    const existing = await this.findTenantById(DEFAULT_TENANT_ID);
    if (existing) {
      return;
    }

    const id = DEFAULT_TENANT_ID;
    const name = 'Default';
    const now = new Date();

    await this.executeStatement(
      `INSERT INTO tenants (
        id,
        name,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES (?, ?, ?, ?, NULL, NULL)`,
      [id, name, now, now]
    );
  }

  /**
   * Lists all tenants ordered by name.
   *
   * This is a global operation not scoped by {@link tenantId}; it returns
   * all tenants in the registry.
   */
  async listTenants(): Promise<TenantRecord[]> {
    const rows = await this.queryRows<
      TenantRecord & RowDataPacket & { avatar_initials: string | null; avatar_color: string | null }
    >(
      'SELECT id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color FROM tenants ORDER BY name ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      avatarInitials: row.avatar_initials,
      avatarColor: row.avatar_color
    }));
  }

  /**
   * Creates a new tenant namespace.
   *
   * Rejects attempts to create a tenant with the reserved {@link DEFAULT_TENANT_ID}.
   * This is a global operation not scoped by {@link tenantId}.
   *
   * @param id - Stable tenant identifier.
   * @param name - Human-readable tenant label.
   * @param actingUserId - User performing the create action.
   * @returns Newly created tenant record.
   * @throws {Error} When the tenant id is reserved or already exists.
   */
  async createTenant(id: string, name: string, actingUserId: string): Promise<TenantRecord> {
    if (isDefaultTenantId(id)) {
      throw new Error('Cannot create tenant with reserved default id.');
    }

    const trimmedName = trimRequiredName(name, 'Tenant name');
    const now = new Date();

    await this.executeStatement(
      `INSERT INTO tenants (
        id,
        name,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, trimmedName, now, now, actingUserId, actingUserId]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'tenant', id);

    const created = await this.findTenantById(id);
    if (!created) {
      throw new Error('Tenant not found after insert');
    }

    return created;
  }

  /**
   * Finds a tenant by stable identifier.
   *
   * This is a global operation not scoped by {@link tenantId}.
   *
   * @param id - Tenant identifier to look up.
   */
  async findTenantById(id: string): Promise<TenantRecord | null> {
    const rows = await this.queryRows<
      TenantRecord & RowDataPacket & { avatar_initials: string | null; avatar_color: string | null }
    >(
      'SELECT id, name, created_at, updated_at, created_by_user_id, updated_by_user_id, avatar_initials, avatar_color FROM tenants WHERE id = ? LIMIT 1',
      [id]
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdByUserId: row.created_by_user_id,
          updatedByUserId: row.updated_by_user_id,
          avatarInitials: row.avatar_initials,
          avatarColor: row.avatar_color
        }
      : null;
  }

  /**
   * Updates persisted hub avatar presentation for a tenant namespace.
   *
   * @param id - Tenant identifier to update.
   * @param avatarInitials - Initials tile text to persist.
   * @param avatarColor - Palette color key to persist.
   * @param actingUserId - User performing the update, or null for system assignment.
   */
  async updateTenantAvatar(
    id: string,
    avatarInitials: string,
    avatarColor: string,
    actingUserId: string | null
  ): Promise<TenantRecord> {
    const now = new Date();
    await this.executeStatement(
      `UPDATE tenants
       SET avatar_initials = ?,
           avatar_color = ?,
           updated_at = ?,
           updated_by_user_id = COALESCE(?, updated_by_user_id)
       WHERE id = ?`,
      [avatarInitials, avatarColor, now, actingUserId, id]
    );

    const updated = await this.findTenantById(id);
    if (!updated) {
      throw new Error('Tenant not found.');
    }

    return updated;
  }

  /**
   * Deletes a tenant namespace and cascades to all tenant-scoped rows.
   *
   * Rejects attempts to delete the reserved {@link DEFAULT_TENANT_ID}.
   * Deletes all tenant-scoped entity rows (users, collections, etc.) before
   * removing the tenant record itself. This is a global operation not scoped
   * by {@link tenantId}.
   *
   * @param id - Tenant identifier to delete.
   * @param actingUserId - User performing the delete action.
   * @throws {Error} When attempting to delete the default tenant.
   */
  async deleteTenant(id: string, actingUserId: string): Promise<void> {
    if (isDefaultTenantId(id)) {
      throw new Error('Cannot delete the default tenant.');
    }

    void actingUserId;

    const connection = await this.requirePool().getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute('DELETE FROM api_tokens WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM user_invitations WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM users WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM run_results WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM discussion_comments WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM llm_usage_log WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM llm_usage WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM documents WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM requests WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM folders WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM live_pages WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM live_servers WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM snippets WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM environments WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM collections WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM audit_log WHERE tenant_id = ?', [id]);
      await connection.execute('DELETE FROM tenants WHERE id = ?', [id]);

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'tenant', id);
  }

  /**
   * Lists audit log entries ordered newest-first with optional filters.
   *
   * @param options - Optional limit and filter criteria.
   */
  async listAuditLog(options: ListAuditLogOptions = {}): Promise<AuditLogRecord[]> {
    const limit = options.limit ?? 100;
    const conditions: string[] = ['tenant_id = ?'];
    const params: Array<string | number> = [this.tenantId];

    if (options.userId !== undefined) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }

    if (options.entityType !== undefined) {
      conditions.push('entity_type = ?');
      params.push(options.entityType);
    }

    if (options.entityId !== undefined) {
      conditions.push('entity_id = ?');
      params.push(options.entityId);
    }

    const whereClause = ` WHERE ${conditions.join(' AND ')}`;
    const rows = await this.queryRows<AuditLogSqlRow & RowDataPacket>(
      `${AUDIT_LOG_SELECT}${whereClause} ORDER BY created_at DESC LIMIT ?`,
      [...params, limit]
    );

    return rows.map(mapAuditLogSqlRow);
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
    const attributionUserId = trimmedName === SYSTEM_USER_NAME ? id : actingUserId;
    const avatar = buildUserAvatarFieldsForCreate(trimmedName, id, input);

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.llmAccess ? 1 : 0,
        serializeAccessList(input.llmModels ?? []),
        input.llmMonthlyTokenLimit ?? null,
        avatar.avatarInitials,
        avatar.avatarColor,
        now,
        now,
        attributionUserId,
        attributionUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'user', id);

    const created = await this.findUserById(id);
    if (!created) {
      throw new Error('User not found after insert');
    }

    return created;
  }

  /**
   * Finds a user by stable identifier.
   *
   * @param id - User identifier to look up.
   */
  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.queryRows<UserSqlRow & RowDataPacket>(
      `${USER_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
    return row ? mapUserSqlRow(row) : null;
  }

  /**
   * Finds a user by unique display name.
   *
   * @param name - User name to look up.
   */
  async findUserByName(name: string): Promise<UserRecord | null> {
    const rows = await this.queryRows<UserSqlRow & RowDataPacket>(
      `${USER_SELECT} WHERE tenant_id = ? AND name = ? LIMIT 1`,
      [this.tenantId, name]
    );
    const row = rows[0];
    return row ? mapUserSqlRow(row) : null;
  }

  /**
   * Lists all user accounts ordered by name.
   */
  async listUsers(): Promise<UserRecord[]> {
    const rows = await this.queryRows<UserSqlRow & RowDataPacket>(
      `${USER_SELECT} WHERE tenant_id = ? ORDER BY name ASC`,
      [this.tenantId]
    );
    return rows.map(mapUserSqlRow);
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
    const updatedAt = new Date();

    const result = await this.executeStatement(
      `UPDATE users
      SET name = ?,
        role = ?,
        collection_access = ?,
        environment_access = ?,
        snippet_access = ?,
        live_server_access = ?,
        live_page_access = ?,
        llm_access = ?,
        llm_models = ?,
        llm_monthly_token_limit = ?,
        avatar_initials = ?,
        avatar_color = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [
        name,
        role,
        serializeAccessList(collectionAccess),
        serializeAccessList(environmentAccess),
        serializeAccessList(snippetAccess),
        serializeAccessList(liveServerAccess),
        serializeAccessList(livePageAccess),
        llmAccess ? 1 : 0,
        serializeAccessList(llmModels),
        llmMonthlyTokenLimit,
        avatarInitials,
        avatarColor,
        updatedAt,
        actingUserId,
        this.tenantId,
        id
      ]
    );

    if ((result.affectedRows ?? 0) === 0) {
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
    const connection = await this.requirePool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM api_tokens WHERE tenant_id = ? AND user_id = ?', [
        this.tenantId,
        id
      ]);
      await connection.execute('DELETE FROM users WHERE tenant_id = ? AND id = ?', [
        this.tenantId,
        id
      ]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'user', id);
  }

  /**
   * Assigns legacy API tokens without an owner to the bootstrap user.
   */
  async migrateOrphanTokensToBootstrapUser(): Promise<void> {
    const rows = await this.queryRows<{ count: number } & RowDataPacket>(
      'SELECT COUNT(*) AS count FROM api_tokens WHERE tenant_id = ? AND user_id IS NULL',
      [this.tenantId]
    );
    const orphanCount = rows[0]?.count ?? 0;
    if (orphanCount === 0) {
      return;
    }

    let bootstrapUser = await this.findUserByName(BOOTSTRAP_USER_NAME);
    if (!bootstrapUser) {
      const systemUserId = this.systemUserId;
      if (!systemUserId) {
        throw new Error('System user is not provisioned');
      }

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

    await this.executeStatement(
      'UPDATE api_tokens SET user_id = ? WHERE tenant_id = ? AND user_id IS NULL',
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
    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
      `${API_TOKEN_SELECT}
      WHERE tenant_id = ?
        AND token_hash = ?
        AND revoked_at IS NULL
        AND user_id IS NOT NULL
      LIMIT 1`,
      [this.tenantId, tokenHash]
    );

    const row = rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
      `${API_TOKEN_SELECT}
      WHERE tenant_id = ?
        AND user_id IS NOT NULL
      ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return rows.map(mapApiTokenSqlRow);
  }

  /**
   * Returns API tokens owned by a specific user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listApiTokensByUserId(userId: string): Promise<ApiTokenRecord[]> {
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
      `${API_TOKEN_SELECT}
      WHERE tenant_id = ?
        AND user_id = ?
      ORDER BY created_at DESC`,
      [this.tenantId, userId]
    );

    return rows.map(mapApiTokenSqlRow);
  }

  /**
   * Finds an API token record by stable identifier.
   *
   * @param id - Token identifier to look up.
   */
  async findApiTokenById(id: string): Promise<ApiTokenRecord | null> {
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
      `${API_TOKEN_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Permanently removes an API token record by id.
   *
   * @param id - Token identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteApiToken(id: string, actingUserId: string): Promise<boolean> {
    const result = await this.executeStatement(
      'DELETE FROM api_tokens WHERE tenant_id = ? AND id = ?',
      [this.tenantId, id]
    );
    const deleted = (result.affectedRows ?? 0) > 0;
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
    const result = await this.executeStatement(
      `UPDATE api_tokens
      SET revoked_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ?
        AND id = ?
        AND revoked_at IS NULL`,
      [new Date(), actingUserId, this.tenantId, id]
    );

    const revoked = (result.affectedRows ?? 0) > 0;
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
    await this.executeStatement(
      `UPDATE api_tokens SET last_used_at = ? WHERE tenant_id = ? AND id = ?`,
      [when, this.tenantId, id]
    );
  }

  /**
   * Inserts a new device key enrollment record.
   *
   * @param record - Device enrollment metadata to persist.
   * @param actingUserId - User performing the enrollment action.
   */
  async createDeviceKey(record: DeviceKeyRecord, actingUserId: string): Promise<void> {
    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const rows = await this.queryRows<DeviceKeySqlRow & RowDataPacket>(
      `${DEVICE_KEY_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );

    const row = rows[0];
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
    const rows = await this.queryRows<DeviceKeySqlRow & RowDataPacket>(
      `${DEVICE_KEY_SELECT}
      WHERE tenant_id = ?
        AND user_id = ?
        AND device_id = ?
        AND revoked_at IS NULL
      LIMIT 1`,
      [this.tenantId, userId, deviceId]
    );

    const row = rows[0];
    return row ? mapDeviceKeySqlRow(row) : null;
  }

  /**
   * Returns device key enrollments owned by a user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listDeviceKeysByUserId(userId: string): Promise<DeviceKeyRecord[]> {
    const rows = await this.queryRows<DeviceKeySqlRow & RowDataPacket>(
      `${DEVICE_KEY_SELECT}
      WHERE tenant_id = ?
        AND user_id = ?
      ORDER BY created_at DESC`,
      [this.tenantId, userId]
    );

    return rows.map(mapDeviceKeySqlRow);
  }

  /**
   * Lists all device key enrollments ordered by creation time descending.
   */
  async listDeviceKeys(): Promise<DeviceKeyRecord[]> {
    const rows = await this.queryRows<DeviceKeySqlRow & RowDataPacket>(
      `${DEVICE_KEY_SELECT}
      WHERE tenant_id = ?
      ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return rows.map(mapDeviceKeySqlRow);
  }

  /**
   * Soft-revokes an active device key enrollment by id.
   *
   * @param id - Device key identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeDeviceKey(id: string, actingUserId: string): Promise<boolean> {
    const result = await this.executeStatement(
      `UPDATE device_keys
      SET revoked_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ?
        AND id = ?
        AND revoked_at IS NULL`,
      [new Date(), actingUserId, this.tenantId, id]
    );

    const revoked = result.affectedRows > 0;
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
    await this.executeStatement(
      `UPDATE device_keys SET last_seen_at = ? WHERE tenant_id = ? AND id = ?`,
      [when, this.tenantId, id]
    );
  }

  /**
   * Returns persisted MLS group state for a discussion thread.
   *
   * @param mlsGroupId - Canonical MLS group id for the thread.
   */
  async getDiscussionMlsGroupState(
    mlsGroupId: string
  ): Promise<DiscussionMlsGroupStateRecord | null> {
    const rows = await this.queryRows<DiscussionMlsGroupStateSqlRow & RowDataPacket>(
      `${DISCUSSION_MLS_GROUP_STATE_SELECT}
      WHERE tenant_id = ? AND mls_group_id = ?
      LIMIT 1`,
      [this.tenantId, mlsGroupId]
    );

    const row = rows[0];
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

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        current_epoch = IF(
          VALUES(current_epoch) >= current_epoch,
          VALUES(current_epoch),
          current_epoch
        ),
        updated_at = IF(
          VALUES(current_epoch) >= current_epoch,
          VALUES(updated_at),
          updated_at
        ),
        updated_by_user_id = IF(
          VALUES(current_epoch) >= current_epoch,
          VALUES(updated_by_user_id),
          updated_by_user_id
        )`,
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

    const record = await this.getDiscussionMlsGroupState(prepared.mlsGroupId);
    if (!record) {
      throw new Error('Discussion MLS group state not found after upsert');
    }

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
    await this.executeStatement(
      `INSERT INTO discussion_mls_commits (
        id,
        tenant_id,
        mls_group_id,
        epoch,
        ciphertext,
        sender_device_id,
        created_at,
        created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const rows = await this.queryRows<DiscussionMlsCommitSqlRow & RowDataPacket>(
      `${DISCUSSION_MLS_COMMIT_SELECT}
      WHERE tenant_id = ?
        AND mls_group_id = ?
        AND (? IS NULL OR epoch > ?)
      ORDER BY epoch ASC
      LIMIT ${limit + 1}`,
      [this.tenantId, options.mlsGroupId, cursorEpoch, cursorEpoch]
    );

    return buildDiscussionMlsCommitListResult(rows.map(mapDiscussionMlsCommitSqlRow), limit);
  }

  /**
   * Finds a relayed MLS commit by stable identifier.
   *
   * @param id - Commit record identifier.
   */
  async findDiscussionMlsCommitById(id: string): Promise<DiscussionMlsCommitRecord | null> {
    const rows = await this.queryRows<DiscussionMlsCommitSqlRow & RowDataPacket>(
      `${DISCUSSION_MLS_COMMIT_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );

    const row = rows[0];
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
    await this.executeStatement(
      `INSERT INTO discussion_mls_welcomes (
        id,
        tenant_id,
        mls_group_id,
        recipient_device_id,
        ciphertext,
        ratchet_tree,
        created_at,
        created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const rows = await this.queryRows<DiscussionMlsWelcomeSqlRow & RowDataPacket>(
      `${DISCUSSION_MLS_WELCOME_SELECT}
      WHERE tenant_id = ?
        AND mls_group_id = ?
        AND (? IS NULL OR recipient_device_id = ?)
      ORDER BY created_at ASC`,
      [
        this.tenantId,
        options.mlsGroupId,
        options.recipientDeviceId ?? null,
        options.recipientDeviceId ?? null
      ]
    );

    return {
      welcomes: rows.map(mapDiscussionMlsWelcomeSqlRow)
    };
  }

  /**
   * Finds a relayed MLS welcome by stable identifier.
   *
   * @param id - Welcome record identifier.
   */
  async findDiscussionMlsWelcomeById(id: string): Promise<DiscussionMlsWelcomeRecord | null> {
    const rows = await this.queryRows<DiscussionMlsWelcomeSqlRow & RowDataPacket>(
      `${DISCUSSION_MLS_WELCOME_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );

    const row = rows[0];
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
    const connection = await this.requirePool().getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          input.llmAccess ? 1 : 0,
          serializeAccessList(input.llmModels ?? []),
          input.llmMonthlyTokenLimit ?? null,
          now,
          now,
          actingUserId,
          actingUserId
        ]
      );

      const [userRows] = await connection.execute<(UserSqlRow & RowDataPacket)[]>(
        `${USER_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [this.tenantId, userId]
      );
      const userRow = userRows[0];
      if (!userRow) {
        throw new Error('User not found after insert');
      }

      await connection.execute(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      await connection.commit();

      await this.recordAuditEntry(actingUserId, 'create', 'user', userId);
      await this.recordAuditEntry(actingUserId, 'create', 'invitation', invitation.id);

      return {
        user: mapUserSqlRow(userRow),
        invitation
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
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

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const rows = await this.queryRows<InvitationSqlRow & RowDataPacket>(
      `${INVITATION_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
    return row ? mapInvitationSqlRow(row) : null;
  }

  /**
   * Finds an invitation by the sha256 hash of its secret.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   */
  async findInvitationByCodeHash(codeHash: string): Promise<InvitationRecord | null> {
    const rows = await this.queryRows<InvitationSqlRow & RowDataPacket>(
      `${INVITATION_SELECT} WHERE tenant_id = ? AND code_hash = ? LIMIT 1`,
      [this.tenantId, codeHash]
    );
    const row = rows[0];
    return row ? mapInvitationSqlRow(row) : null;
  }

  /**
   * Lists all invitations ordered by creation time descending.
   */
  async listInvitations(): Promise<InvitationRecord[]> {
    const rows = await this.queryRows<InvitationSqlRow & RowDataPacket>(
      `${INVITATION_SELECT} WHERE tenant_id = ? ORDER BY created_at DESC`,
      [this.tenantId]
    );
    return rows.map(mapInvitationSqlRow);
  }

  /**
   * Revokes a pending invitation by id.
   *
   * @param id - Invitation identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeInvitation(id: string, actingUserId: string): Promise<boolean> {
    const now = new Date();
    const result = await this.executeStatement(
      `UPDATE user_invitations
      SET revoked_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ?
        AND id = ?
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > ?`,
      [now, actingUserId, this.tenantId, id, now]
    );

    const revoked = (result.affectedRows ?? 0) > 0;
    if (revoked) {
      await this.recordAuditEntry(actingUserId, 'update', 'invitation', id);
    }

    return revoked;
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
    const connection = await this.requirePool().getConnection();

    try {
      await connection.beginTransaction();

      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE user_invitations
        SET redeemed_at = ?,
          updated_by_user_id = ?
        WHERE tenant_id = ?
          AND code_hash = ?
          AND redeemed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > ?`,
        [now, actingUserId, this.tenantId, codeHash, now]
      );

      if ((updateResult.affectedRows ?? 0) === 0) {
        const [existingRows] = await connection.execute<(InvitationSqlRow & RowDataPacket)[]>(
          `${INVITATION_SELECT} WHERE tenant_id = ? AND code_hash = ? LIMIT 1`,
          [this.tenantId, codeHash]
        );
        const existingRow = existingRows[0];
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

      const [rows] = await connection.execute<(InvitationSqlRow & RowDataPacket)[]>(
        `${INVITATION_SELECT} WHERE tenant_id = ? AND code_hash = ? LIMIT 1`,
        [this.tenantId, codeHash]
      );
      const invitationRow = rows[0];
      if (!invitationRow) {
        throw new Error('Invitation not found after claim');
      }

      const invitation = mapInvitationSqlRow(invitationRow);
      const [userRows] = await connection.execute<(UserSqlRow & RowDataPacket)[]>(
        `${USER_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [this.tenantId, invitation.userId]
      );
      const userRow = userRows[0];
      if (!userRow) {
        throw new Error('User not found');
      }

      const user = mapUserSqlRow(userRow);
      const { record, secret } = generateApiToken(user.id, tokenName);

      await connection.execute(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      await connection.commit();

      await this.recordAuditEntry(actingUserId, 'update', 'invitation', invitation.id);
      await this.recordAuditEntry(actingUserId, 'create', 'api_token', record.id);

      return { user, token: record, secret };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Lists all collections ordered by name.
   */
  async listCollections(): Promise<CollectionRecord[]> {
    const rows = await this.queryRows<CollectionSqlRow & RowDataPacket>(
      `${COLLECTION_SELECT} WHERE tenant_id = ? ORDER BY name ASC`,
      [this.tenantId]
    );
    return rows.map(mapCollectionSqlRow);
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

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, '[]', '[]', ?, '', '', ?, ?, ?, ?)`,
      [
        id,
        this.tenantId,
        trimmedName,
        MYSQL_DEFAULT_AUTH_JSON,
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'collection', id);

    const rows = await this.queryRows<CollectionSqlRow & RowDataPacket>(
      `${COLLECTION_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Collection not found after insert');
    }

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
        ? await this.executeStatement(
            `UPDATE collections
      SET name = ?,
        variables = ?,
        headers = ?,
        auth = ?,
        pre_request_script = ?,
        post_request_script = ?,
        updated_at = ?,
        updated_by_user_id = ?,
        marker = ?
      WHERE tenant_id = ? AND id = ?`,
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
              this.tenantId,
              id
            ]
          )
        : await this.executeStatement(
            `UPDATE collections
      SET name = ?,
        variables = ?,
        headers = ?,
        auth = ?,
        pre_request_script = ?,
        post_request_script = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
            [
              trimmedName,
              JSON.stringify(variables),
              JSON.stringify(headers),
              JSON.stringify(auth),
              preRequestScript,
              postRequestScript,
              updatedAt,
              actingUserId,
              this.tenantId,
              id
            ]
          );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Collection not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);

    const rows = await this.queryRows<CollectionSqlRow & RowDataPacket>(
      `${COLLECTION_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    await this.executeStatement('DELETE FROM collections WHERE tenant_id = ? AND id = ?', [
      this.tenantId,
      id
    ]);
  }

  /**
   * Finds a collection by stable identifier.
   *
   * @param id - Collection ID to look up.
   */
  async findCollectionById(id: string): Promise<CollectionRecord | null> {
    const rows = await this.queryRows<CollectionSqlRow & RowDataPacket>(
      `${COLLECTION_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const result = await this.executeStatement(
      `UPDATE collections
      SET deletion_locked = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [deletionLocked ? 1 : 0, updatedAt, actingUserId, this.tenantId, id]
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Collection not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);

    const rows = await this.queryRows<CollectionSqlRow & RowDataPacket>(
      `${COLLECTION_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Collection not found');
    }

    return mapCollectionSqlRow(row);
  }

  /**
   * Lists all environments ordered by name.
   */
  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const rows = await this.queryRows<EnvironmentSqlRow & RowDataPacket>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = ? ORDER BY name ASC`,
      [this.tenantId]
    );
    return rows.map(mapEnvironmentSqlRow);
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

    await this.executeStatement(
      `INSERT INTO environments (
        id,
        tenant_id,
        name,
        variables,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) VALUES (?, ?, ?, '[]', ?, ?, ?, ?)`,
      [id, this.tenantId, trimmedName, now, now, actingUserId, actingUserId]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'environment', id);

    const rows = await this.queryRows<EnvironmentSqlRow & RowDataPacket>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Environment not found after insert');
    }

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
    const setClauses = ['name = ?', 'variables = ?', 'updated_at = ?', 'updated_by_user_id = ?'];
    const params: Array<string | number | Date | null> = [
      trimmedName,
      JSON.stringify(variables),
      updatedAt,
      actingUserId
    ];

    if (marker !== undefined) {
      setClauses.push('marker = ?');
      params.push(serializeSidebarMarker(marker));
    }
    if (parentUuid !== undefined) {
      setClauses.push('parent_uuid = ?');
      params.push(parentUuid?.trim() || null);
    }
    params.push(this.tenantId);
    params.push(id);

    const result = await this.executeStatement(
      `UPDATE environments
      SET ${setClauses.join(',\n        ')}
      WHERE tenant_id = ? AND id = ?`,
      params
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Environment not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);

    const rows = await this.queryRows<EnvironmentSqlRow & RowDataPacket>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    await this.executeStatement(
      'UPDATE environments SET parent_uuid = NULL WHERE tenant_id = ? AND parent_uuid = ?',
      [this.tenantId, id]
    );
    await this.executeStatement('DELETE FROM environments WHERE tenant_id = ? AND id = ?', [
      this.tenantId,
      id
    ]);
  }

  /**
   * Finds an environment by stable identifier.
   *
   * @param id - Environment ID to look up.
   */
  async findEnvironmentById(id: string): Promise<EnvironmentRecord | null> {
    const rows = await this.queryRows<EnvironmentSqlRow & RowDataPacket>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const result = await this.executeStatement(
      `UPDATE environments
      SET deletion_locked = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [deletionLocked ? 1 : 0, updatedAt, actingUserId, this.tenantId, id]
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Environment not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);

    const rows = await this.queryRows<EnvironmentSqlRow & RowDataPacket>(
      `${ENVIRONMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Environment not found');
    }

    return mapEnvironmentSqlRow(row);
  }

  /**
   * Lists all snippets ordered by sort order then name.
   */
  async listSnippets(): Promise<SnippetRecord[]> {
    const rows = await this.queryRows<SnippetSqlRow & RowDataPacket>(
      `${SNIPPET_SELECT} WHERE tenant_id = ? ORDER BY sort_order ASC, name ASC`,
      [this.tenantId]
    );
    return rows.map(mapSnippetSqlRow);
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
    const maxRows = await this.queryRows<{ max_order: number | null } & RowDataPacket>(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM snippets WHERE tenant_id = ?',
      [this.tenantId]
    );
    const maxOrder = maxRows[0]?.max_order ?? -1;

    await this.executeStatement(
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
        updated_by_user_id,
        deletion_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        actingUserId,
        0
      ]
    );

    await this.recordAuditEntry(actingUserId, 'create', 'snippet', id);

    const rows = await this.queryRows<SnippetSqlRow & RowDataPacket>(
      `${SNIPPET_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Snippet not found after insert');
    }

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
    const result = await this.executeStatement(
      `UPDATE snippets
      SET name = ?,
        code = ?,
        scope = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [trimmedName, code, scope, updatedAt, actingUserId, this.tenantId, id]
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Snippet not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);

    const rows = await this.queryRows<SnippetSqlRow & RowDataPacket>(
      `${SNIPPET_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    await this.executeStatement('DELETE FROM snippets WHERE tenant_id = ? AND id = ?', [
      this.tenantId,
      id
    ]);
  }

  /**
   * Finds a snippet by stable identifier.
   *
   * @param id - Snippet ID to look up.
   */
  async findSnippetById(id: string): Promise<SnippetRecord | null> {
    const rows = await this.queryRows<SnippetSqlRow & RowDataPacket>(
      `${SNIPPET_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const result = await this.executeStatement(
      `UPDATE snippets
      SET deletion_locked = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [deletionLocked ? 1 : 0, updatedAt, actingUserId, this.tenantId, id]
    );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Snippet not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);

    const rows = await this.queryRows<SnippetSqlRow & RowDataPacket>(
      `${SNIPPET_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const rows = await this.queryRows<PayloadEntitySqlRow & RowDataPacket>(
      `SELECT ${PAYLOAD_ENTITY_SELECT_COLUMNS} FROM ${table} WHERE tenant_id = ? ORDER BY name ASC`,
      [this.tenantId]
    );
    return rows.map(mapper);
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
    await this.executeStatement(
      `INSERT INTO ${table} (id, tenant_id, name, payload, created_at, updated_at, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        this.tenantId,
        trimRequiredName(input.name, 'Entity name'),
        JSON.stringify(input.payload),
        now,
        now,
        actingUserId,
        actingUserId
      ]
    );
    await this.recordAuditEntry(actingUserId, 'create', entityType, id);
    const record = await this.findPayloadEntity(table, id, mapper);
    if (!record) throw new Error('Entity not found after insert');
    return record;
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
    const result = await this.executeStatement(
      `UPDATE ${table} SET name = ?, payload = ?, updated_at = ?, updated_by_user_id = ? WHERE tenant_id = ? AND id = ?`,
      [
        trimRequiredName(input.name, 'Entity name'),
        JSON.stringify(input.payload),
        new Date(),
        actingUserId,
        this.tenantId,
        id
      ]
    );
    if (result.affectedRows === 0) throw new Error('Entity not found');
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    const record = await this.findPayloadEntity(table, id, mapper);
    if (!record) throw new Error('Entity not found');
    return record;
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
    await this.executeStatement(`DELETE FROM ${table} WHERE tenant_id = ? AND id = ?`, [
      this.tenantId,
      id
    ]);
  }

  /**
   * Finds one JSON-payload entity.
   */
  private async findPayloadEntity<T>(
    table: 'live_servers' | 'live_pages',
    id: string,
    mapper: (row: PayloadEntitySqlRow) => T
  ): Promise<T | null> {
    const rows = await this.queryRows<PayloadEntitySqlRow & RowDataPacket>(
      `SELECT ${PAYLOAD_ENTITY_SELECT_COLUMNS} FROM ${table} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    return rows[0] ? mapper(rows[0]) : null;
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
    const result = await this.executeStatement(
      `UPDATE ${table} SET deletion_locked = ?, updated_at = ?, updated_by_user_id = ? WHERE tenant_id = ? AND id = ?`,
      [deletionLocked ? 1 : 0, new Date(), actingUserId, this.tenantId, id]
    );
    if (result.affectedRows === 0) throw new Error('Entity not found');
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    const record = await this.findPayloadEntity(table, id, mapper);
    if (!record) throw new Error('Entity not found');
    return record;
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const rows = await this.queryRows<RequestSqlRow & RowDataPacket>(
      `${REQUEST_SELECT} WHERE tenant_id = ? AND collection_id = ? ORDER BY sort_order ASC, name ASC`,
      [this.tenantId, collectionId]
    );
    return rows.map(mapRequestSqlRow);
  }

  /**
   * Finds a saved request by id.
   *
   * @param id - Request identifier to look up.
   */
  async findRequestById(id: string): Promise<SavedRequestRecord | null> {
    const rows = await this.queryRows<RequestSqlRow & RowDataPacket>(
      `${REQUEST_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
      const folderRows = await this.queryRows<{ collection_id: string } & RowDataPacket>(
        'SELECT collection_id FROM folders WHERE tenant_id = ? AND id = ?',
        [this.tenantId, folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result = await this.executeStatement(
        `UPDATE requests SET
          collection_id = ?,
          folder_id = ?,
          name = ?,
          method = ?,
          protocol = ?,
          url = ?,
          headers = ?,
          params = ?,
          auth = ?,
          body = ?,
          body_type = ?,
          pre_request_script = ?,
          post_request_script = ?,
          comment = ?,
          marker = ?,
          updated_at = ?,
          updated_by_user_id = ?
        WHERE tenant_id = ? AND id = ?`,
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
          this.tenantId,
          input.id
        ]
      );

      if ((result.affectedRows ?? 0) > 0) {
        await this.recordAuditEntry(actingUserId, 'update', 'request', input.id);

        const rows = await this.queryRows<RequestSqlRow & RowDataPacket>(
          `${REQUEST_SELECT} WHERE tenant_id = ? AND id = ?`,
          [this.tenantId, input.id]
        );
        const row = rows[0];
        if (row) {
          return mapRequestSqlRow(row);
        }
      }
    }

    const maxRows = await this.queryRows<{ max_order: number | null } & RowDataPacket>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM requests
       WHERE tenant_id = ? AND collection_id = ?
         AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`,
      [this.tenantId, input.collectionId, folderId, folderId]
    );
    const maxOrder = maxRows[0]?.max_order ?? -1;
    const id = randomUUID();

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    await this.recordAuditEntry(actingUserId, 'create', 'request', id);

    const rows = await this.queryRows<RequestSqlRow & RowDataPacket>(
      `${REQUEST_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Request not found after insert');
    }

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
    await this.executeStatement('DELETE FROM requests WHERE tenant_id = ? AND id = ?', [
      this.tenantId,
      id
    ]);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listFolders(collectionId: string): Promise<FolderRecord[]> {
    const rows = await this.queryRows<FolderSqlRow & RowDataPacket>(
      `${FOLDER_SELECT} WHERE tenant_id = ? AND collection_id = ? ORDER BY sort_order ASC, name ASC`,
      [this.tenantId, collectionId]
    );
    return rows.map(mapFolderSqlRow);
  }

  /**
   * Finds a folder by id.
   *
   * @param id - Folder identifier to look up.
   */
  async findFolderById(id: string): Promise<FolderRecord | null> {
    const rows = await this.queryRows<FolderSqlRow & RowDataPacket>(
      `${FOLDER_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const maxRows = await this.queryRows<{ max_order: number | null } & RowDataPacket>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order
       FROM folders
       WHERE tenant_id = ? AND collection_id = ? AND parent_folder_id <=> ?`,
      [this.tenantId, collectionId, parentFolderId]
    );
    const maxOrder = maxRows[0]?.max_order ?? -1;

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    await this.recordAuditEntry(actingUserId, 'create', 'folder', id);

    const rows = await this.queryRows<FolderSqlRow & RowDataPacket>(
      `${FOLDER_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Folder not found after insert');
    }

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
        ? await this.executeStatement(
            `UPDATE folders
      SET name = ?,
        updated_at = ?,
        updated_by_user_id = ?,
        marker = ?
      WHERE tenant_id = ? AND id = ?`,
            [
              trimmedName,
              updatedAt,
              actingUserId,
              serializeSidebarMarker(marker),
              this.tenantId,
              id
            ]
          )
        : await this.executeStatement(
            `UPDATE folders
      SET name = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
            [trimmedName, updatedAt, actingUserId, this.tenantId, id]
          );

    if ((result.affectedRows ?? 0) === 0) {
      throw new Error('Folder not found');
    }

    await this.recordAuditEntry(actingUserId, 'update', 'folder', id);

    const rows = await this.queryRows<FolderSqlRow & RowDataPacket>(
      `${FOLDER_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Folder not found');
    }

    return mapFolderSqlRow(row);
  }

  /**
   * Deletes a folder, its descendants, and their contents.
   *
   * @param id - Folder ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteFolder(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'folder', id);

    const root = await this.findFolderById(id);
    if (!root) {
      return;
    }
    const folders = await this.listFolders(root.collectionId);
    const descendantIds = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (
          folder.parentFolderId != null &&
          descendantIds.has(folder.parentFolderId) &&
          !descendantIds.has(folder.id)
        ) {
          descendantIds.add(folder.id);
          changed = true;
        }
      }
    }
    const ids = [...descendantIds];
    const placeholders = ids.map(() => '?').join(', ');
    const connection = await this.requirePool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `DELETE FROM documents WHERE tenant_id = ? AND folder_id IN (${placeholders})`,
        [this.tenantId, ...ids]
      );
      await connection.execute(
        `DELETE FROM requests WHERE tenant_id = ? AND folder_id IN (${placeholders})`,
        [this.tenantId, ...ids]
      );
      for (const folderId of ids.reverse()) {
        await connection.execute('DELETE FROM folders WHERE tenant_id = ? AND id = ?', [
          this.tenantId,
          folderId
        ]);
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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
      let ancestor = folders.find((entry) => entry.id === parentFolderId);
      if (!ancestor) {
        throw new Error('Parent folder not found in collection');
      }
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
    await this.executeStatement(
      `UPDATE folders
       SET parent_folder_id = ?, updated_at = ?, updated_by_user_id = ?
       WHERE tenant_id = ? AND id = ?`,
      [parentFolderId, new Date(), actingUserId, this.tenantId, id]
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
    const connection = await this.requirePool().getConnection();
    const updatedAt = new Date();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedFolderIds.length; index++) {
        await connection.execute(
          `UPDATE folders
          SET sort_order = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE tenant_id = ? AND id = ? AND collection_id = ? AND parent_folder_id <=> ?`,
          [
            index,
            updatedAt,
            actingUserId,
            this.tenantId,
            orderedFolderIds[index],
            collectionId,
            parentFolderId
          ]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await this.recordAuditEntry(actingUserId, 'reorder', 'collection', collectionId, {
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
    const connection = await this.requirePool().getConnection();
    const updatedAt = new Date();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedRequestIds.length; index++) {
        await connection.execute(
          `UPDATE requests
          SET sort_order = ?,
            folder_id = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE tenant_id = ? AND id = ? AND collection_id = ?`,
          [
            index,
            folderId,
            updatedAt,
            actingUserId,
            this.tenantId,
            orderedRequestIds[index],
            collectionId
          ]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await this.recordAuditEntry(actingUserId, 'reorder', 'collection', collectionId, {
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
    const connection = await this.requirePool().getConnection();
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
      const [rows] = await connection.execute<(RowDataPacket & { id: string })[]>(
        `SELECT id FROM requests WHERE tenant_id = ? AND collection_id = ?
         AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)
         ORDER BY sort_order ASC, name ASC`,
        [this.tenantId, collectionId, targetFolderId, targetFolderId]
      );
      return rows.map((row) => row.id);
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
        await connection.execute(
          `UPDATE requests
          SET sort_order = ?,
            folder_id = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE tenant_id = ? AND id = ?`,
          [sortIndex, targetFolderId, updatedAt, actingUserId, this.tenantId, orderedIds[sortIndex]]
        );
      }
    };

    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.execute<(RequestSqlRow & RowDataPacket)[]>(
        `${REQUEST_SELECT} WHERE tenant_id = ? AND id = ?`,
        [this.tenantId, requestId]
      );
      const requestRow = requestRows[0];
      if (!requestRow) {
        throw new Error('Request not found');
      }

      const request = mapRequestSqlRow(requestRow);
      const collectionId = request.collectionId;
      const oldFolderId = request.folderId;

      if (folderId != null) {
        const [folderRows] = await connection.execute<
          (RowDataPacket & { collection_id: string })[]
        >('SELECT collection_id FROM folders WHERE tenant_id = ? AND id = ?', [
          this.tenantId,
          folderId
        ]);
        const folderRow = folderRows[0];
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

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
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
    const rows = await this.queryRows<DocumentSqlRow & RowDataPacket>(
      `${DOCUMENT_SELECT} WHERE tenant_id = ? AND collection_id = ? ORDER BY sort_order ASC, name ASC`,
      [this.tenantId, collectionId]
    );
    return rows.map(mapDocumentSqlRow);
  }

  /**
   * Finds a document by id.
   *
   * @param id - Document identifier to look up.
   */
  async findDocumentById(id: string): Promise<DocumentRecord | null> {
    const rows = await this.queryRows<DocumentSqlRow & RowDataPacket>(
      `${DOCUMENT_SELECT} WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
      const folderRows = await this.queryRows<{ collection_id: string } & RowDataPacket>(
        'SELECT collection_id FROM folders WHERE tenant_id = ? AND id = ?',
        [this.tenantId, folderId]
      );
      const folderRow = folderRows[0];
      if (!folderRow || folderRow.collection_id !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const result = await this.executeStatement(
        `UPDATE documents SET
          collection_id = ?,
          folder_id = ?,
          name = ?,
          content = ?,
          marker = ?,
          updated_at = ?,
          updated_by_user_id = ?
        WHERE tenant_id = ? AND id = ?`,
        [
          input.collectionId,
          folderId,
          trimmedName,
          input.content,
          serializedMarker,
          now,
          actingUserId,
          this.tenantId,
          input.id
        ]
      );

      if ((result.affectedRows ?? 0) > 0) {
        await this.recordAuditEntry(actingUserId, 'update', 'document', input.id);

        const rows = await this.queryRows<DocumentSqlRow & RowDataPacket>(
          `${DOCUMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
          [this.tenantId, input.id]
        );
        const row = rows[0];
        if (row) {
          return mapDocumentSqlRow(row);
        }
      }
    }

    const maxRows = await this.queryRows<{ max_order: number | null } & RowDataPacket>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM documents
       WHERE tenant_id = ? AND collection_id = ?
         AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)`,
      [this.tenantId, input.collectionId, folderId, folderId]
    );
    const maxOrder = maxRows[0]?.max_order ?? -1;
    const id = randomUUID();

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    await this.recordAuditEntry(actingUserId, 'create', 'document', id);

    const rows = await this.queryRows<DocumentSqlRow & RowDataPacket>(
      `${DOCUMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Document not found after insert');
    }

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
    await this.executeStatement('DELETE FROM documents WHERE tenant_id = ? AND id = ?', [
      this.tenantId,
      id
    ]);
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
    const connection = await this.requirePool().getConnection();
    const updatedAt = new Date();
    try {
      await connection.beginTransaction();
      for (let index = 0; index < orderedDocumentIds.length; index++) {
        await connection.execute(
          `UPDATE documents
          SET sort_order = ?,
            folder_id = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE tenant_id = ? AND id = ? AND collection_id = ?`,
          [
            index,
            folderId,
            updatedAt,
            actingUserId,
            this.tenantId,
            orderedDocumentIds[index],
            collectionId
          ]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
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
    const connection = await this.requirePool().getConnection();
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
      const rows = await this.queryRows<{ id: string } & RowDataPacket>(
        `SELECT id FROM documents WHERE tenant_id = ? AND collection_id = ?
         AND ((? IS NULL AND folder_id IS NULL) OR folder_id = ?)
         ORDER BY sort_order ASC, name ASC`,
        [this.tenantId, collectionId, targetFolderId, targetFolderId]
      );
      return rows.map((row) => row.id);
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
        await connection.execute(
          `UPDATE documents
          SET sort_order = ?,
            folder_id = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE tenant_id = ? AND id = ?`,
          [sortIndex, targetFolderId, updatedAt, actingUserId, this.tenantId, orderedIds[sortIndex]]
        );
      }
    };

    try {
      await connection.beginTransaction();

      const documentRows = await this.queryRows<DocumentSqlRow & RowDataPacket>(
        `${DOCUMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
        [this.tenantId, documentId]
      );
      const documentRow = documentRows[0];
      if (!documentRow) {
        throw new Error('Document not found');
      }

      const document = mapDocumentSqlRow(documentRow);
      const collectionId = document.collectionId;
      const oldFolderId = document.folderId;

      if (folderId != null) {
        const folderRows = await this.queryRows<{ collection_id: string } & RowDataPacket>(
          'SELECT collection_id FROM folders WHERE tenant_id = ? AND id = ?',
          [this.tenantId, folderId]
        );
        const folderRow = folderRows[0];
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

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
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
    const [rows] = await this.requirePool().execute<(LlmUsageSqlRow & RowDataPacket)[]>(
      `${LLM_USAGE_SELECT} WHERE tenant_id = ? AND user_id = ? AND period = ? LIMIT 1`,
      [this.tenantId, userId, period]
    );
    const row = rows[0];
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

    await this.executeStatement(
      `INSERT INTO llm_usage (
        id,
        tenant_id,
        user_id,
        period,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        prompt_tokens = prompt_tokens + VALUES(prompt_tokens),
        completion_tokens = completion_tokens + VALUES(completion_tokens),
        total_tokens = total_tokens + VALUES(total_tokens),
        updated_at = VALUES(updated_at)`,
      [id, this.tenantId, userId, period, promptTokens, completionTokens, totalDelta, now]
    );

    const usage = await this.getLlmUsage(userId, period);
    if (!usage) {
      throw new Error('LLM usage not found after upsert');
    }

    return usage;
  }

  /**
   * Inserts a per-request LLM usage log entry.
   *
   * @param input - Usage details for one successful completion step.
   */
  async createLlmUsageLog(input: CreateLlmUsageLogInput): Promise<LlmUsageLogRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.isNewTurn ? 1 : 0,
        input.hadToolCalls ? 1 : 0,
        input.messageCount,
        now
      ]
    );

    const rows = await this.queryRows<LlmUsageLogSqlRow & RowDataPacket>(
      `${LLM_USAGE_LOG_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    if (!row) {
      throw new Error('LLM usage log not found after insert');
    }

    return mapLlmUsageLogSqlRow(row);
  }

  /**
   * Lists all per-request LLM usage log entries, newest first.
   */
  async listLlmUsageLogs(): Promise<LlmUsageLogRecord[]> {
    const rows = await this.queryRows<LlmUsageLogSqlRow & RowDataPacket>(
      `${LLM_USAGE_LOG_SELECT} WHERE tenant_id = ? ORDER BY created_at DESC`,
      [this.tenantId]
    );

    return rows.map(mapLlmUsageLogSqlRow);
  }

  /**
   * Lists run results saved by the given user, newest first.
   */
  async listRunResultsForUser(userId: string): Promise<RunResultRecord[]> {
    const rows = await this.queryRows<RunResultSqlRow & RowDataPacket>(
      `${RUN_RESULT_SELECT} WHERE tenant_id = ? AND created_by_user_id = ? ORDER BY created_at DESC`,
      [this.tenantId, userId]
    );
    return rows.map(mapRunResultSqlRow);
  }

  /**
   * Lists all run results for admin inspection, newest first.
   */
  async listAllRunResults(): Promise<RunResultRecord[]> {
    const rows = await this.queryRows<RunResultSqlRow & RowDataPacket>(
      `${RUN_RESULT_SELECT} WHERE tenant_id = ? ORDER BY created_at DESC`,
      [this.tenantId]
    );
    return rows.map(mapRunResultSqlRow);
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

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const rows = await this.queryRows<RunResultSqlRow & RowDataPacket>(
      `${RUN_RESULT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
    const rows = await this.queryRows<RunResultSqlRow & RowDataPacket>(
      `${RUN_RESULT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
    return row ? mapRunResultSqlRow(row) : null;
  }

  /**
   * Deletes a run result by id.
   */
  async deleteRunResult(id: string, actingUserId: string): Promise<void> {
    const result = await this.executeStatement(
      'DELETE FROM run_results WHERE tenant_id = ? AND id = ?',
      [this.tenantId, id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
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

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
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

    const rows = await this.queryRows<DiscussionCommentSqlRow & RowDataPacket>(
      `${DISCUSSION_COMMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, prepared.id]
    );
    const row = rows[0];
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

    const rows = await this.queryRows<DiscussionCommentSqlRow & RowDataPacket>(
      `${DISCUSSION_COMMENT_SELECT}
      WHERE tenant_id = ?
        AND target_entity_type = ?
        AND target_entity_id = ?
        AND (? IS NULL OR created_at > ?)
      ORDER BY created_at ASC
      LIMIT ?`,
      [this.tenantId, options.targetEntityType, options.targetEntityId, cursor, cursor, limit + 1]
    );

    return buildDiscussionListResult(rows, limit);
  }

  /**
   * Finds a discussion comment by id within the current tenant.
   */
  async findDiscussionCommentById(id: string): Promise<DiscussionCommentRecord | null> {
    const rows = await this.queryRows<DiscussionCommentSqlRow & RowDataPacket>(
      `${DISCUSSION_COMMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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

    const result = await this.executeStatement(
      `UPDATE discussion_comments
      SET body = ?, body_format = ?, body_metadata = ?, updated_at = ?
      WHERE tenant_id = ? AND id = ?`,
      [
        normalized.body,
        normalized.bodyFormat,
        serializeDiscussionBodyMetadata(normalized.bodyMetadata),
        now,
        this.tenantId,
        id
      ]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      throw new DiscussionCommentNotFoundError();
    }

    const rows = await this.queryRows<DiscussionCommentSqlRow & RowDataPacket>(
      `${DISCUSSION_COMMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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

    const result = await this.executeStatement(
      `UPDATE discussion_comments
      SET body = '', updated_at = ?, tombstoned_at = ?, tombstoned_by_user_id = ?
      WHERE tenant_id = ? AND id = ?`,
      [now, now, actingUserId, this.tenantId, id]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      throw new DiscussionCommentNotFoundError();
    }

    const rows = await this.queryRows<DiscussionCommentSqlRow & RowDataPacket>(
      `${DISCUSSION_COMMENT_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, id]
    );
    const row = rows[0];
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
      await this.executeStatement(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
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

      const rows = await this.queryRows<NoticeSqlRow & RowDataPacket>(
        `${NOTICE_SELECT} WHERE tenant_id = ? AND id = ?`,
        [this.tenantId, id]
      );
      const row = rows[0];
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

    const rows = await this.queryRows<NoticeSqlRow & RowDataPacket>(
      `${NOTICE_SELECT}
      WHERE tenant_id = ?
        AND recipient_user_id = ?
        AND (? IS NULL OR created_at < ?)
      ORDER BY created_at DESC
      LIMIT ?`,
      [this.tenantId, options.recipientUserId, cursor, cursor, limit + 1]
    );

    return buildNoticeListResult(rows, limit);
  }

  /**
   * Counts unread notices for a recipient without loading the full feed.
   */
  async countUnreadNotices(recipientUserId: string): Promise<number> {
    const rows = await this.queryRows<{ count: number } & RowDataPacket>(
      `SELECT COUNT(*) AS count
       FROM notices
       WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [this.tenantId, recipientUserId]
    );
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Marks one notice read for the authenticated recipient.
   */
  async markNoticeRead(noticeId: string, recipientUserId: string): Promise<NoticeRecord | null> {
    const now = new Date();
    const result = await this.executeStatement(
      `UPDATE notices
       SET read_at = ?
       WHERE tenant_id = ? AND id = ? AND recipient_user_id = ?`,
      [now, this.tenantId, noticeId, recipientUserId]
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      return null;
    }

    const rows = await this.queryRows<NoticeSqlRow & RowDataPacket>(
      `${NOTICE_SELECT} WHERE tenant_id = ? AND id = ?`,
      [this.tenantId, noticeId]
    );
    const row = rows[0];
    return row ? mapNoticeSqlRow(row) : null;
  }

  /**
   * Marks all unread notices read for a recipient.
   */
  async markAllNoticesRead(recipientUserId: string): Promise<number> {
    const now = new Date();
    const result = await this.executeStatement(
      `UPDATE notices
       SET read_at = ?
       WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [now, this.tenantId, recipientUserId]
    );
    return (result as ResultSetHeader).affectedRows;
  }

  /**
   * Returns notification settings for a user, defaulting to `all` when unset.
   */
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettingsRecord> {
    const rows = await this.queryRows<
      { level: NotificationLevel; updated_at: Date } & RowDataPacket
    >(
      `SELECT level, updated_at
       FROM user_notification_settings
       WHERE tenant_id = ? AND user_id = ?`,
      [this.tenantId, userId]
    );

    const row = rows[0];
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
    await this.executeStatement(
      `INSERT INTO user_notification_settings (user_id, tenant_id, level, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE level = VALUES(level), updated_at = VALUES(updated_at)`,
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
    await this.executeStatement(
      `INSERT IGNORE INTO discussion_thread_subscriptions (user_id, tenant_id, root_comment_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [userId, this.tenantId, rootCommentId, now]
    );

    return { userId, rootCommentId, createdAt: now };
  }

  /**
   * Removes a user's subscription to a discussion thread.
   */
  async unsubscribeDiscussionThread(userId: string, rootCommentId: string): Promise<void> {
    await this.executeStatement(
      `DELETE FROM discussion_thread_subscriptions
       WHERE tenant_id = ? AND user_id = ? AND root_comment_id = ?`,
      [this.tenantId, userId, rootCommentId]
    );
  }

  /**
   * Returns true when the user is subscribed to a discussion thread.
   */
  async isSubscribedToDiscussionThread(userId: string, rootCommentId: string): Promise<boolean> {
    const rows = await this.queryRows<{ count: number } & RowDataPacket>(
      `SELECT COUNT(*) AS count
       FROM discussion_thread_subscriptions
       WHERE tenant_id = ? AND user_id = ? AND root_comment_id = ?`,
      [this.tenantId, userId, rootCommentId]
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  /**
   * Lists user ids subscribed to a discussion thread.
   */
  async listDiscussionThreadSubscribers(rootCommentId: string): Promise<string[]> {
    const rows = await this.queryRows<{ user_id: string } & RowDataPacket>(
      `SELECT user_id FROM discussion_thread_subscriptions
       WHERE tenant_id = ? AND root_comment_id = ?`,
      [this.tenantId, rootCommentId]
    );
    return rows.map((row) => row.user_id);
  }

  /**
   * Ensures the internal system user exists and caches its identifier.
   */
  async ensureSystemUser(): Promise<void> {
    const existing = await this.findUserByName(SYSTEM_USER_NAME);
    if (existing) {
      this.systemUserId = existing.id;
      return;
    }

    const input = createSystemUserInput();
    const id = randomUUID();
    const now = new Date();
    const trimmedName = trimRequiredName(input.name, 'User name');

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        0,
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
   * Persists a single audit log entry with a snapshot of the acting user's name.
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
    const userName = await resolveActingUserName(this.findUserById.bind(this), actingUserId);
    const id = randomUUID();
    const now = new Date();

    await this.executeStatement(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
   * Returns the active pool or throws when connect has not been called.
   *
   * @returns Connected MySQL pool.
   * @throws {Error} When the database is not connected.
   */
  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('MySQL database is not connected.');
    }

    return this.pool;
  }

  /**
   * Executes a parameterized SELECT and returns matching rows.
   *
   * @param sql - SQL statement with ? placeholders.
   * @param params - Bound parameter values.
   * @returns Query rows from mysql2.
   */
  private async queryRows<T extends RowDataPacket>(
    sql: string,
    params: Array<string | number | Date | null> = []
  ): Promise<T[]> {
    const [rows] = await this.requirePool().execute<T[]>(sql, params);
    return rows;
  }

  /**
   * Executes a parameterized statement and returns result metadata.
   *
   * @param sql - SQL statement with ? placeholders.
   * @param params - Bound parameter values.
   * @returns Result metadata such as affected row counts.
   */
  private async executeStatement(
    sql: string,
    params: Array<string | number | Date | null> = []
  ): Promise<ResultSetHeader> {
    const [result] = await this.requirePool().execute(sql, params);
    return result as ResultSetHeader;
  }
}
