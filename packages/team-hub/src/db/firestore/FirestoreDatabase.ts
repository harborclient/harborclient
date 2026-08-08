import { randomUUID } from 'node:crypto';
import { Firestore, type DocumentReference, type Query } from '@google-cloud/firestore';
import { buildUserAvatarFieldsForCreate } from '#/avatar/userAvatarService.js';
import { defaultAvatarPresentation } from '#/avatar/avatarPresentation.js';
import { resolveActingUserName } from '#/db/attribution.js';
import { BOOTSTRAP_USER_NAME } from '#/db/bootstrapUsers.js';
import { InvitationUnavailableError } from '#/db/invitationErrors.js';
import {
  API_TOKENS_COLLECTION,
  AUDIT_LOG_COLLECTION,
  COLLECTIONS_COLLECTION,
  DEVICE_KEYS_COLLECTION,
  DISCUSSION_MLS_COMMITS_COLLECTION,
  DISCUSSION_MLS_GROUP_STATE_COLLECTION,
  DISCUSSION_MLS_WELCOMES_COLLECTION,
  DOCUMENTS_COLLECTION,
  ENVIRONMENTS_COLLECTION,
  FOLDERS_COLLECTION,
  INVITATIONS_COLLECTION,
  LLM_USAGE_COLLECTION,
  LLM_USAGE_LOG_COLLECTION,
  LIVE_PAGES_COLLECTION,
  LIVE_SERVERS_COLLECTION,
  REQUESTS_COLLECTION,
  RUN_RESULTS_COLLECTION,
  DISCUSSION_COMMENTS_COLLECTION,
  NOTICES_COLLECTION,
  USER_NOTIFICATION_SETTINGS_COLLECTION,
  DISCUSSION_THREAD_SUBSCRIPTIONS_COLLECTION,
  SNIPPETS_COLLECTION,
  TENANTS_COLLECTION,
  USERS_COLLECTION,
  WRITE_BATCH_LIMIT
} from '#/db/firestore/const.js';
import { createSystemUserInput, SYSTEM_USER_NAME } from '#/db/systemUsers.js';
import { firestoreConfigSchema } from '#/db/firestore/schemas.js';
import { DEFAULT_TENANT_ID } from '#/config/multitenancyConfig.js';
import type {
  FirestoreApiTokenDocument,
  FirestoreDeviceKeyDocument,
  FirestoreDiscussionMlsCommitDocument,
  FirestoreDiscussionMlsGroupStateDocument,
  FirestoreDiscussionMlsWelcomeDocument,
  FirestoreAuditLogDocument,
  FirestoreCollectionDocument,
  FirestoreDatabaseConfig,
  FirestoreEnvironmentDocument,
  FirestoreFolderDocument,
  FirestoreInvitationDocument,
  FirestoreLlmUsageDocument,
  FirestoreLlmUsageLogDocument,
  FirestorePayloadEntityDocument,
  FirestoreRequestDocument,
  FirestoreDocumentDocument,
  FirestoreRunResultDocument,
  FirestoreDiscussionCommentDocument,
  FirestoreNoticeDocument,
  FirestoreUserNotificationSettingsDocument,
  FirestoreDiscussionThreadSubscriptionDocument,
  FirestoreSnippetDocument,
  FirestoreTenantDocument,
  FirestoreUserDocument
} from '#/db/firestore/types.js';
import {
  mapFirestoreApiToken,
  mapFirestoreDeviceKey,
  mapFirestoreDiscussionMlsCommit,
  mapFirestoreDiscussionMlsGroupState,
  mapFirestoreDiscussionMlsWelcome,
  mapFirestoreAuditLog,
  mapFirestoreCollection,
  mapFirestoreEnvironment,
  mapFirestoreFolder,
  mapFirestoreInvitation,
  mapFirestoreLlmUsage,
  mapFirestoreLlmUsageLog,
  mapFirestoreLivePage,
  mapFirestoreLiveServer,
  mapFirestoreRequest,
  mapFirestoreDocument,
  mapFirestoreRunResult,
  mapFirestoreDiscussionComment,
  mapFirestoreNotice,
  mapFirestoreUserNotificationSettings,
  mapFirestoreDiscussionThreadSubscription,
  mapFirestoreSnippet,
  mapFirestoreUser
} from '#/db/firestore/utils.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { buildDefaultRunResultLabel, parseRunResultPayload } from '#/db/runResultPayload.js';
import {
  buildDiscussionMlsCommitListResult,
  buildDiscussionMlsGroupStateRecord,
  normalizeDiscussionMlsCommitListLimit,
  parseDiscussionMlsCommitListCursor
} from '#/db/discussionMlsLogic.js';
import {
  normalizeDiscussionListLimit,
  normalizeDiscussionUpdateInput,
  parseDiscussionListCursor,
  prepareSqlDiscussionCommentInsert,
  assertDiscussionCommentEditable,
  buildDiscussionListResult
} from '#/db/discussionCommentSql.js';
import {
  buildNoticeListResult,
  normalizeNoticeListLimit,
  parseNoticeListCursor
} from '#/db/noticeSql.js';
import { type NoticeSqlRow } from '#/db/noticeRows.js';
import { DiscussionCommentNotFoundError } from '#/db/discussionCommentErrors.js';
import { generateApiToken } from '#/server/auth/apiTokens.js';
import { trimRequiredName } from '#/db/trimRequiredName.js';
import { serializeSidebarMarker } from '#/db/sidebarMarker.js';
import { assertUserNameAvailable, assertUserNameNotReserved } from '#/db/userNameValidation.js';
import type {
  ApiTokenRecord,
  DeviceKeyRecord,
  AuditAction,
  AuditEntityType,
  AuditLogRecord,
  AuthConfig,
  CollectionRecord,
  CreateRunResultInput,
  CreateLivePageRecordInput,
  CreateLiveServerRecordInput,
  CreateUserInput,
  CreatedInvitedUserResult,
  CreateLlmUsageLogInput,
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
  SaveRequestInput,
  SaveDocumentInput,
  RunResultRecord,
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
import { defaultAuth } from '#/db/types.js';
import { formatZodError } from '#/db/validation.js';

/**
 * Firestore-backed database implementation.
 */
export class FirestoreDatabase implements IDatabase {
  /**
   * Active Firestore client, or null when disconnected.
   */
  private client: Firestore | null = null;

  /**
   * Cached identifier of the internal system user, when provisioned during migration.
   */
  private systemUserId: string | null = null;

  /**
   * Tenant namespace for this database instance.
   */
  private readonly tenantId: string;

  /**
   * When true, this instance owns the Firestore client and must disconnect it.
   */
  private readonly ownsClient: boolean;

  /**
   * Creates a Firestore database instance from validated config.
   *
   * @param config - Parsed Firestore connection settings.
   * @param tenantId - Tenant namespace identifier; defaults to {@link DEFAULT_TENANT_ID}.
   * @param ownsClient - When true, disconnect terminates the client; defaults to true.
   */
  constructor(
    private readonly config: FirestoreDatabaseConfig,
    tenantId: string = DEFAULT_TENANT_ID,
    ownsClient = true
  ) {
    this.tenantId = tenantId;
    this.ownsClient = ownsClient;
  }

  /**
   * Validates raw config and constructs a {@link FirestoreDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured Firestore database instance.
   * @throws {Error} When config fails Firestore-specific validation.
   */
  static fromConfig(config: unknown): FirestoreDatabase {
    const parsed = firestoreConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new FirestoreDatabase({
      projectId: parsed.data.projectId,
      keyFilename: parsed.data.keyFilename
    });
  }

  /**
   * Opens a Firestore client and verifies connectivity by listing collections.
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const client = new Firestore({
      projectId: this.config.projectId,
      keyFilename: this.config.keyFilename
    });

    await client.listCollections();

    this.client = client;
  }

  /**
   * Terminates the Firestore client and releases resources.
   *
   * Only disconnects when this instance owns the client; shared clients remain active.
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.ownsClient) {
      return;
    }

    await this.client.terminate();
    this.client = null;
  }

  /**
   * Verifies Firestore connectivity via `listCollections()` for readiness probes.
   *
   * @throws {Error} When the client is not connected or the list call fails.
   */
  async ping(): Promise<void> {
    await this.requireClient().listCollections();
  }

  /**
   * Firestore uses schemaless documents; provisions the default tenant, system user,
   * and migrates orphan tokens.
   */
  async migrate(): Promise<void> {
    await this.ensureDefaultTenant();
    await this.ensureSystemUser();
    await this.migrateOrphanTokensToBootstrapUser();
    await this.migrateSnippetAccessBackfill();
    await this.migrateUserAvatarBackfill();
  }

  /**
   * Assigns default avatar initials and colors to users missing persisted values.
   */
  private async migrateUserAvatarBackfill(): Promise<void> {
    const client = this.requireClient();
    const snapshot = await client
      .collection(USERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .get();

    if (snapshot.docs.length === 0) {
      return;
    }

    let batch = client.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as FirestoreUserDocument;
      if (data.avatarInitials?.trim() && data.avatarColor?.trim()) {
        continue;
      }

      const defaults = defaultAvatarPresentation(data.name, doc.id);
      batch.update(doc.ref, {
        avatarInitials: defaults.initials,
        avatarColor: defaults.color
      });
      batchSize += 1;

      if (batchSize >= WRITE_BATCH_LIMIT) {
        await batch.commit();
        batch = client.batch();
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
    }
  }

  /**
   * Returns the stable identifier of the internal system user, when provisioned.
   */
  getSystemUserId(): string | null {
    return this.systemUserId;
  }

  /**
   * Returns the tenant namespace identifier for this database instance.
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Creates a new database instance scoped to a different tenant, sharing the
   * same Firestore client.
   *
   * @param tenantId - Target tenant namespace identifier.
   * @returns New database instance scoped to the specified tenant.
   */
  forTenant(tenantId: string): FirestoreDatabase {
    const scoped = new FirestoreDatabase(this.config, tenantId, false);
    scoped.client = this.client;
    scoped.systemUserId = this.systemUserId;
    return scoped;
  }

  /**
   * Ensures the default tenant exists in the global tenants collection.
   *
   * Inserts directly without tenant filtering since this is the bootstrap operation.
   */
  async ensureDefaultTenant(): Promise<void> {
    const client = this.requireClient();
    const docRef = client.collection(TENANTS_COLLECTION).doc(DEFAULT_TENANT_ID);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      return;
    }

    const now = new Date();
    const data: FirestoreTenantDocument = {
      name: 'Default',
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null
    };
    await docRef.set(data);
  }

  /**
   * Lists all tenants ordered by creation time.
   *
   * Tenant records are global and not filtered by the instance's tenant scope.
   */
  async listTenants(): Promise<TenantRecord[]> {
    const snapshot = await this.requireClient()
      .collection(TENANTS_COLLECTION)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreTenantDocument;
      return {
        id: doc.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdByUserId: data.createdByUserId,
        updatedByUserId: data.updatedByUserId,
        avatarInitials: data.avatarInitials ?? null,
        avatarColor: data.avatarColor ?? null,
        avatarImage: data.avatarImage ?? null,
        avatarImageKey: data.avatarImageKey ?? null,
        avatarImageMime: data.avatarImageMime ?? null,
        avatarImageUpdatedAt: data.avatarImageUpdatedAt ?? null
      };
    });
  }

  /**
   * Creates a new tenant namespace in the global tenants collection.
   *
   * @param id - Unique tenant identifier for the namespace.
   * @param name - Human-readable tenant label.
   * @param actingUserId - User performing the create action.
   * @returns Created tenant record.
   * @throws {Error} When the tenant id is reserved or already exists.
   */
  async createTenant(id: string, name: string, actingUserId: string): Promise<TenantRecord> {
    if (id === DEFAULT_TENANT_ID) {
      throw new Error('Cannot create the reserved default tenant.');
    }

    const client = this.requireClient();
    const docRef = client.collection(TENANTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      throw new Error('Tenant already exists.');
    }

    const now = new Date();
    const data: FirestoreTenantDocument = {
      name,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await docRef.set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'tenant', id);

    return {
      id,
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      createdByUserId: data.createdByUserId,
      updatedByUserId: data.updatedByUserId,
      avatarInitials: null,
      avatarColor: null,
      avatarImage: null,
      avatarImageKey: null,
      avatarImageMime: null,
      avatarImageUpdatedAt: null
    };
  }

  /**
   * Finds a tenant by stable identifier in the global tenants collection.
   *
   * @param id - Tenant identifier to look up.
   * @returns Tenant record, or null when not found.
   */
  async findTenantById(id: string): Promise<TenantRecord | null> {
    const snapshot = await this.requireClient().collection(TENANTS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreTenantDocument;
    return {
      id: snapshot.id,
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      createdByUserId: data.createdByUserId,
      updatedByUserId: data.updatedByUserId,
      avatarInitials: data.avatarInitials ?? null,
      avatarColor: data.avatarColor ?? null,
      avatarImage: data.avatarImage ?? null,
      avatarImageKey: data.avatarImageKey ?? null,
      avatarImageMime: data.avatarImageMime ?? null,
      avatarImageUpdatedAt: data.avatarImageUpdatedAt ?? null
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
    const docRef = this.requireClient().collection(TENANTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Tenant not found.');
    }

    const now = new Date();
    const existing = snapshot.data() as FirestoreTenantDocument;
    const next: FirestoreTenantDocument = {
      ...existing,
      avatarInitials,
      avatarColor,
      updatedAt: now,
      updatedByUserId: actingUserId ?? existing.updatedByUserId
    };
    if (image !== undefined) {
      next.avatarImage = image.imageBase64;
      next.avatarImageKey = image.imageKey;
      next.avatarImageMime = image.mime;
      next.avatarImageUpdatedAt = image.updatedAt;
    }
    await docRef.set(next);

    const updated = await this.findTenantById(id);
    if (!updated) {
      throw new Error('Tenant not found.');
    }

    return updated;
  }

  /**
   * Deletes a tenant namespace and all of its data across all collections.
   *
   * @param id - Tenant identifier to delete.
   * @param actingUserId - User performing the delete action.
   * @throws {Error} When attempting to delete the default tenant.
   */
  async deleteTenant(id: string, actingUserId: string): Promise<void> {
    if (id === DEFAULT_TENANT_ID) {
      throw new Error('Cannot delete the default tenant.');
    }

    void actingUserId;

    const client = this.requireClient();
    const collections = [
      USERS_COLLECTION,
      API_TOKENS_COLLECTION,
      DEVICE_KEYS_COLLECTION,
      INVITATIONS_COLLECTION,
      COLLECTIONS_COLLECTION,
      ENVIRONMENTS_COLLECTION,
      SNIPPETS_COLLECTION,
      LIVE_SERVERS_COLLECTION,
      LIVE_PAGES_COLLECTION,
      FOLDERS_COLLECTION,
      REQUESTS_COLLECTION,
      DOCUMENTS_COLLECTION,
      AUDIT_LOG_COLLECTION,
      LLM_USAGE_COLLECTION,
      LLM_USAGE_LOG_COLLECTION,
      RUN_RESULTS_COLLECTION,
      DISCUSSION_COMMENTS_COLLECTION
    ];

    const refs: DocumentReference[] = [];
    for (const collection of collections) {
      const snapshot = await client.collection(collection).where('tenantId', '==', id).get();
      for (const doc of snapshot.docs) {
        refs.push(doc.ref);
      }
    }

    refs.push(client.collection(TENANTS_COLLECTION).doc(id));
    await this.commitBatchedDeletes(refs);
    await this.recordAuditEntry(actingUserId, 'delete', 'tenant', id);
  }

  /**
   * Lists audit log entries ordered newest-first with optional filters.
   *
   * Filters by the instance's tenant namespace.
   *
   * @param options - Optional limit and filter criteria.
   */
  async listAuditLog(options: ListAuditLogOptions = {}): Promise<AuditLogRecord[]> {
    const limit = options.limit ?? 100;
    let query: Query = this.requireClient()
      .collection(AUDIT_LOG_COLLECTION)
      .where('tenantId', '==', this.tenantId);

    if (options.userId !== undefined) {
      query = query.where('userId', '==', options.userId);
    }

    if (options.entityType !== undefined) {
      query = query.where('entityType', '==', options.entityType);
    }

    if (options.entityId !== undefined) {
      query = query.where('entityId', '==', options.entityId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map((doc) =>
      mapFirestoreAuditLog(doc.id, doc.data() as FirestoreAuditLogDocument)
    );
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
    const data: FirestoreUserDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimmedName,
      role: input.role,
      collectionAccess: input.collectionAccess,
      environmentAccess: input.environmentAccess,
      snippetAccess: input.snippetAccess,
      liveServerAccess: input.liveServerAccess,
      livePageAccess: input.livePageAccess,
      llmAccess: input.llmAccess ?? false,
      llmModels: input.llmModels ?? [],
      llmMonthlyTokenLimit: input.llmMonthlyTokenLimit ?? null,
      avatarInitials: avatar.avatarInitials,
      avatarColor: avatar.avatarColor,
      avatarImage: null,
      avatarImageKey: null,
      avatarImageMime: null,
      avatarImageUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: attributionUserId,
      updatedByUserId: attributionUserId
    };

    await this.requireClient().collection(USERS_COLLECTION).doc(id).set(data);
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
    const snapshot = await this.requireClient().collection(USERS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreUserDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreUser(id, data as FirestoreUserDocument);
  }

  /**
   * Finds a user by unique display name.
   *
   * @param name - User name to look up.
   */
  async findUserByName(name: string): Promise<UserRecord | null> {
    const snapshot = await this.requireClient()
      .collection(USERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('name', '==', name)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    return mapFirestoreUser(doc.id, doc.data() as FirestoreUserDocument);
  }

  /**
   * Lists all user accounts ordered by name.
   */
  async listUsers(): Promise<UserRecord[]> {
    const snapshot = await this.requireClient()
      .collection(USERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('name')
      .get();
    return snapshot.docs.map((doc) =>
      mapFirestoreUser(doc.id, doc.data() as FirestoreUserDocument)
    );
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

    await this.requireClient().collection(USERS_COLLECTION).doc(id).update({
      name,
      role,
      collectionAccess,
      environmentAccess,
      snippetAccess,
      liveServerAccess,
      livePageAccess,
      llmAccess,
      llmModels,
      llmMonthlyTokenLimit,
      avatarInitials,
      avatarColor,
      avatarImage,
      avatarImageKey,
      avatarImageMime,
      avatarImageUpdatedAt,
      updatedAt,
      updatedByUserId: actingUserId
    });

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
    const client = this.requireClient();
    const tokenSnapshot = await client
      .collection(API_TOKENS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('userId', '==', id)
      .get();

    const batch = client.batch();

    for (const doc of tokenSnapshot.docs) {
      batch.delete(doc.ref);
    }

    batch.delete(client.collection(USERS_COLLECTION).doc(id));
    await batch.commit();

    await this.recordAuditEntry(actingUserId, 'delete', 'user', id);
  }

  /**
   * Assigns legacy API tokens without an owner to the bootstrap user.
   */
  async migrateOrphanTokensToBootstrapUser(): Promise<void> {
    const client = this.requireClient();
    const snapshot = await client
      .collection(API_TOKENS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .get();
    const orphanDocs = snapshot.docs.filter((doc) => {
      const data = doc.data() as Partial<FirestoreApiTokenDocument>;
      return data.userId === undefined || data.userId === null || data.userId === '';
    });

    if (orphanDocs.length === 0) {
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

    for (let index = 0; index < orphanDocs.length; index += WRITE_BATCH_LIMIT) {
      const batch = client.batch();
      const chunk = orphanDocs.slice(index, index + WRITE_BATCH_LIMIT);
      for (const doc of chunk) {
        batch.update(doc.ref, { userId: bootstrapUser.id });
      }
      await batch.commit();
    }
  }

  /**
   * Grants wildcard snippet access to user accounts that already have wildcard collection access.
   */
  async migrateSnippetAccessBackfill(): Promise<void> {
    const client = this.requireClient();
    const snapshot = await client
      .collection(USERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('role', '==', 'user')
      .get();
    if (snapshot.docs.length === 0) {
      return;
    }

    let batch = client.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as FirestoreUserDocument;
      if (!data.collectionAccess?.includes('*')) {
        continue;
      }

      const accessUpdates = {
        ...((data.snippetAccess?.length ?? 0) === 0 ? { snippetAccess: ['*'] } : {}),
        ...((data.liveServerAccess?.length ?? 0) === 0 ? { liveServerAccess: ['*'] } : {}),
        ...((data.livePageAccess?.length ?? 0) === 0 ? { livePageAccess: ['*'] } : {})
      };
      if (Object.keys(accessUpdates).length === 0) continue;
      batch.update(doc.ref, accessUpdates);
      batchSize += 1;

      if (batchSize >= WRITE_BATCH_LIMIT) {
        await batch.commit();
        batch = client.batch();
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
    }
  }

  /**
   * Inserts a new API token document.
   *
   * @param record - Token metadata to persist.
   * @param actingUserId - User performing the create action.
   */
  async createApiToken(record: ApiTokenRecord, actingUserId: string): Promise<void> {
    await this.requireClient().collection(API_TOKENS_COLLECTION).doc(record.id).set({
      tenantId: this.tenantId,
      userId: record.userId,
      name: record.name,
      tokenHash: record.tokenHash,
      tokenPrefix: record.tokenPrefix,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'create', 'api_token', record.id);
  }

  /**
   * Finds an active token by its stored hash.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   */
  async findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    const data = doc.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null || !data.userId) {
      return null;
    }

    return mapFirestoreApiToken(doc.id, data);
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreApiToken(doc.id, doc.data() as FirestoreApiTokenDocument))
      .filter((token) => Boolean(token.userId));
  }

  /**
   * Returns API tokens owned by a specific user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listApiTokensByUserId(userId: string): Promise<ApiTokenRecord[]> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreApiToken(doc.id, doc.data() as FirestoreApiTokenDocument)
    );
  }

  /**
   * Finds an API token record by stable identifier.
   *
   * @param id - Token identifier to look up.
   */
  async findApiTokenById(id: string): Promise<ApiTokenRecord | null> {
    const docRef = this.requireClient().collection(API_TOKENS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreApiTokenDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreApiToken(snapshot.id, data as FirestoreApiTokenDocument);
  }

  /**
   * Permanently removes an API token record by id.
   *
   * @param id - Token identifier to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteApiToken(id: string, actingUserId: string): Promise<boolean> {
    const docRef = this.requireClient().collection(API_TOKENS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    await docRef.delete();
    await this.recordAuditEntry(actingUserId, 'delete', 'api_token', id);
    return true;
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeApiToken(id: string, actingUserId: string): Promise<boolean> {
    const docRef = this.requireClient().collection(API_TOKENS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null) {
      return false;
    }

    await docRef.update({ revokedAt: new Date(), updatedByUserId: actingUserId });
    await this.recordAuditEntry(actingUserId, 'update', 'api_token', id);
    return true;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .doc(id)
      .update({ lastUsedAt: when });
  }

  /**
   * Inserts a new device key enrollment document.
   *
   * @param record - Device enrollment metadata to persist.
   * @param actingUserId - User performing the enrollment action.
   */
  async createDeviceKey(record: DeviceKeyRecord, actingUserId: string): Promise<void> {
    await this.requireClient().collection(DEVICE_KEYS_COLLECTION).doc(record.id).set({
      tenantId: this.tenantId,
      userId: record.userId,
      deviceId: record.deviceId,
      label: record.label,
      keyFormat: record.keyFormat,
      publicKeyMaterial: record.publicKeyMaterial,
      fingerprint: record.fingerprint,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      revokedAt: record.revokedAt,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'create', 'device_key', record.id);
  }

  /**
   * Finds a device key enrollment by stable identifier.
   *
   * @param id - Device key record identifier.
   */
  async findDeviceKeyById(id: string): Promise<DeviceKeyRecord | null> {
    const docRef = this.requireClient().collection(DEVICE_KEYS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDeviceKeyDocument & { tenantId?: string };
    if (data.tenantId != null && data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDeviceKey(snapshot.id, data as FirestoreDeviceKeyDocument);
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
    const snapshot = await this.requireClient()
      .collection(DEVICE_KEYS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('userId', '==', userId)
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    const data = doc.data() as FirestoreDeviceKeyDocument;
    if (data.revokedAt !== null) {
      return null;
    }

    return mapFirestoreDeviceKey(doc.id, data);
  }

  /**
   * Returns device key enrollments owned by a user ordered newest-first.
   *
   * @param userId - Owning user identifier.
   */
  async listDeviceKeysByUserId(userId: string): Promise<DeviceKeyRecord[]> {
    const snapshot = await this.requireClient()
      .collection(DEVICE_KEYS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreDeviceKey(doc.id, doc.data() as FirestoreDeviceKeyDocument)
    );
  }

  /**
   * Lists all device key enrollments ordered by creation time descending.
   */
  async listDeviceKeys(): Promise<DeviceKeyRecord[]> {
    const snapshot = await this.requireClient()
      .collection(DEVICE_KEYS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreDeviceKey(doc.id, doc.data() as FirestoreDeviceKeyDocument)
    );
  }

  /**
   * Soft-revokes an active device key enrollment by id.
   *
   * @param id - Device key identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeDeviceKey(id: string, actingUserId: string): Promise<boolean> {
    const docRef = this.requireClient().collection(DEVICE_KEYS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() as FirestoreDeviceKeyDocument;
    if (data.revokedAt !== null) {
      return false;
    }

    await docRef.update({ revokedAt: new Date(), updatedByUserId: actingUserId });
    await this.recordAuditEntry(actingUserId, 'update', 'device_key', id);
    return true;
  }

  /**
   * Updates the last-seen timestamp for an enrolled device.
   *
   * @param id - Device key identifier.
   * @param when - Timestamp of the latest successful enrollment confirmation.
   */
  async touchDeviceKeyLastSeen(id: string, when: Date): Promise<void> {
    await this.requireClient()
      .collection(DEVICE_KEYS_COLLECTION)
      .doc(id)
      .update({ lastSeenAt: when });
  }

  /**
   * Returns persisted MLS group state for a discussion thread.
   *
   * @param mlsGroupId - Canonical MLS group id for the thread.
   */
  async getDiscussionMlsGroupState(
    mlsGroupId: string
  ): Promise<DiscussionMlsGroupStateRecord | null> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_MLS_GROUP_STATE_COLLECTION)
      .doc(mlsGroupId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDiscussionMlsGroupStateDocument & {
      tenantId?: string;
    };
    if (data.tenantId != null && data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDiscussionMlsGroupState(mlsGroupId, data);
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
    const docRef = this.requireClient()
      .collection(DISCUSSION_MLS_GROUP_STATE_COLLECTION)
      .doc(prepared.mlsGroupId);

    if (!existing) {
      await docRef.set({
        tenantId: this.tenantId,
        mlsGroupId: prepared.mlsGroupId,
        targetEntityType: prepared.targetEntityType,
        targetEntityId: prepared.targetEntityId,
        currentEpoch: prepared.currentEpoch,
        createdAt: prepared.createdAt,
        updatedAt: prepared.updatedAt,
        createdByUserId: actingUserId,
        updatedByUserId: actingUserId
      } satisfies FirestoreDiscussionMlsGroupStateDocument & { tenantId: string });
      await this.recordAuditEntry(
        actingUserId,
        'create',
        'discussion_mls_group_state',
        prepared.mlsGroupId
      );
    } else if (prepared.currentEpoch >= existing.currentEpoch) {
      await docRef.update({
        currentEpoch: prepared.currentEpoch,
        updatedAt: prepared.updatedAt,
        updatedByUserId: actingUserId
      });
      if (prepared.currentEpoch > existing.currentEpoch) {
        await this.recordAuditEntry(
          actingUserId,
          'update',
          'discussion_mls_group_state',
          prepared.mlsGroupId
        );
      }
    }

    const record = await this.getDiscussionMlsGroupState(prepared.mlsGroupId);
    if (!record) {
      throw new Error('Discussion MLS group state not found after upsert');
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
    await this.requireClient()
      .collection(DISCUSSION_MLS_COMMITS_COLLECTION)
      .doc(record.id)
      .set({
        tenantId: this.tenantId,
        mlsGroupId: record.mlsGroupId,
        epoch: record.epoch,
        ciphertext: record.ciphertext,
        senderDeviceId: record.senderDeviceId,
        createdAt: record.createdAt,
        createdByUserId: actingUserId
      } satisfies FirestoreDiscussionMlsCommitDocument & { tenantId: string });

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

    let query: Query = this.requireClient()
      .collection(DISCUSSION_MLS_COMMITS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('mlsGroupId', '==', options.mlsGroupId);

    if (cursorEpoch != null) {
      query = query.where('epoch', '>', cursorEpoch);
    }

    const snapshot = await query
      .orderBy('epoch', 'asc')
      .limit(limit + 1)
      .get();
    const commits = snapshot.docs.map((doc) =>
      mapFirestoreDiscussionMlsCommit(doc.id, doc.data() as FirestoreDiscussionMlsCommitDocument)
    );

    return buildDiscussionMlsCommitListResult(commits, limit);
  }

  /**
   * Finds a relayed MLS commit by stable identifier.
   *
   * @param id - Commit record identifier.
   */
  async findDiscussionMlsCommitById(id: string): Promise<DiscussionMlsCommitRecord | null> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_MLS_COMMITS_COLLECTION)
      .doc(id)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDiscussionMlsCommitDocument & { tenantId?: string };
    if (data.tenantId != null && data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDiscussionMlsCommit(snapshot.id, data);
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
    await this.requireClient()
      .collection(DISCUSSION_MLS_WELCOMES_COLLECTION)
      .doc(record.id)
      .set({
        tenantId: this.tenantId,
        mlsGroupId: record.mlsGroupId,
        recipientDeviceId: record.recipientDeviceId,
        ciphertext: record.ciphertext,
        ratchetTree: record.ratchetTree,
        createdAt: record.createdAt,
        createdByUserId: actingUserId
      } satisfies FirestoreDiscussionMlsWelcomeDocument & { tenantId: string });

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
    let query: Query = this.requireClient()
      .collection(DISCUSSION_MLS_WELCOMES_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('mlsGroupId', '==', options.mlsGroupId);

    if (options.recipientDeviceId) {
      query = query.where('recipientDeviceId', '==', options.recipientDeviceId);
    }

    const snapshot = await query.orderBy('createdAt', 'asc').get();
    return {
      welcomes: snapshot.docs.map((doc) =>
        mapFirestoreDiscussionMlsWelcome(
          doc.id,
          doc.data() as FirestoreDiscussionMlsWelcomeDocument
        )
      )
    };
  }

  /**
   * Finds a relayed MLS welcome by stable identifier.
   *
   * @param id - Welcome record identifier.
   */
  async findDiscussionMlsWelcomeById(id: string): Promise<DiscussionMlsWelcomeRecord | null> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_MLS_WELCOMES_COLLECTION)
      .doc(id)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDiscussionMlsWelcomeDocument & { tenantId?: string };
    if (data.tenantId != null && data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDiscussionMlsWelcome(snapshot.id, data);
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
    const client = this.requireClient();
    const userRef = client.collection(USERS_COLLECTION).doc(userId);
    const invitationRef = client.collection(INVITATIONS_COLLECTION).doc(invitation.id);
    const avatar = buildUserAvatarFieldsForCreate(trimmedName, userId, input);
    const userData: FirestoreUserDocument = {
      name: trimmedName,
      role: input.role,
      collectionAccess: input.collectionAccess,
      environmentAccess: input.environmentAccess,
      snippetAccess: input.snippetAccess,
      liveServerAccess: input.liveServerAccess,
      livePageAccess: input.livePageAccess,
      llmAccess: input.llmAccess ?? false,
      llmModels: input.llmModels ?? [],
      llmMonthlyTokenLimit: input.llmMonthlyTokenLimit ?? null,
      avatarInitials: avatar.avatarInitials,
      avatarColor: avatar.avatarColor,
      avatarImage: null,
      avatarImageKey: null,
      avatarImageMime: null,
      avatarImageUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };
    const invitationData: FirestoreInvitationDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId: invitation.userId,
      codeHash: invitation.codeHash,
      codePrefix: invitation.codePrefix,
      expiresAt: invitation.expiresAt,
      redeemedAt: invitation.redeemedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await client.runTransaction(async (transaction) => {
      const userDataWithTenant: FirestoreUserDocument & { tenantId: string } = {
        ...userData,
        tenantId: this.tenantId
      };
      transaction.set(userRef, userDataWithTenant);
      transaction.set(invitationRef, invitationData);
    });

    await this.recordAuditEntry(actingUserId, 'create', 'user', userId);
    await this.recordAuditEntry(actingUserId, 'create', 'invitation', invitation.id);

    return {
      user: mapFirestoreUser(userId, userData),
      invitation
    };
  }

  /**
   * Persists a new onboarding invitation for an existing user account.
   *
   * Scopes the invitation to the instance's tenant namespace.
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

    const data: FirestoreInvitationDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId: invitation.userId,
      codeHash: invitation.codeHash,
      codePrefix: invitation.codePrefix,
      expiresAt: invitation.expiresAt,
      redeemedAt: invitation.redeemedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await this.requireClient().collection(INVITATIONS_COLLECTION).doc(invitation.id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'invitation', invitation.id);
    return invitation;
  }

  /**
   * Finds an invitation by stable identifier within the instance's tenant namespace.
   *
   * @param id - Invitation identifier to look up.
   */
  async findInvitationById(id: string): Promise<InvitationRecord | null> {
    const snapshot = await this.requireClient().collection(INVITATIONS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreInvitationDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreInvitation(snapshot.id, data as FirestoreInvitationDocument);
  }

  /**
   * Finds an invitation by the sha256 hash of its secret within the instance's tenant namespace.
   *
   * @param codeHash - sha256 hex digest of the invitation secret.
   */
  async findInvitationByCodeHash(codeHash: string): Promise<InvitationRecord | null> {
    const snapshot = await this.requireClient()
      .collection(INVITATIONS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('codeHash', '==', codeHash)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    return mapFirestoreInvitation(doc.id, doc.data() as FirestoreInvitationDocument);
  }

  /**
   * Lists all invitations ordered by creation time descending within the instance's tenant namespace.
   */
  async listInvitations(): Promise<InvitationRecord[]> {
    const snapshot = await this.requireClient()
      .collection(INVITATIONS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreInvitation(doc.id, doc.data() as FirestoreInvitationDocument)
    );
  }

  /**
   * Revokes a pending invitation by id within the instance's tenant namespace.
   *
   * @param id - Invitation identifier to revoke.
   * @param actingUserId - User performing the revoke action.
   */
  async revokeInvitation(id: string, actingUserId: string): Promise<boolean> {
    const docRef = this.requireClient().collection(INVITATIONS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() as FirestoreInvitationDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return false;
    }

    const now = new Date();
    if (
      data.redeemedAt !== null ||
      data.revokedAt !== null ||
      data.expiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    await docRef.update({ revokedAt: now, updatedByUserId: actingUserId });
    await this.recordAuditEntry(actingUserId, 'update', 'invitation', id);
    return true;
  }

  /**
   * Atomically consumes a pending invitation and issues a permanent API token.
   *
   * Scopes the search and token creation to the instance's tenant namespace.
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
    const client = this.requireClient();
    const invitationQuery = client
      .collection(INVITATIONS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('codeHash', '==', codeHash)
      .limit(1);

    let user!: UserRecord;
    let invitation!: InvitationRecord;
    let token!: ApiTokenRecord;
    let secret!: string;

    await client.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationQuery);
      const invitationDoc = invitationSnapshot.docs[0];
      if (!invitationDoc) {
        throw new InvitationUnavailableError('not_found');
      }

      const invitationData = invitationDoc.data() as FirestoreInvitationDocument;
      if (invitationData.redeemedAt) {
        throw new InvitationUnavailableError('redeemed');
      }

      if (invitationData.revokedAt) {
        throw new InvitationUnavailableError('revoked');
      }

      if (invitationData.expiresAt.getTime() <= now.getTime()) {
        throw new InvitationUnavailableError('expired');
      }

      transaction.update(invitationDoc.ref, {
        redeemedAt: now,
        updatedByUserId: actingUserId
      });

      const userRef = client.collection(USERS_COLLECTION).doc(invitationData.userId);
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) {
        throw new Error('User not found');
      }

      user = mapFirestoreUser(userSnapshot.id, userSnapshot.data() as FirestoreUserDocument);
      invitation = mapFirestoreInvitation(invitationDoc.id, {
        ...invitationData,
        redeemedAt: now,
        updatedByUserId: actingUserId
      });

      const generated = generateApiToken(user.id, tokenName);
      token = generated.record;
      secret = generated.secret;

      const tokenRef = client.collection(API_TOKENS_COLLECTION).doc(token.id);
      const tokenData: FirestoreApiTokenDocument & { tenantId: string } = {
        tenantId: this.tenantId,
        userId: token.userId,
        name: token.name,
        tokenHash: token.tokenHash,
        tokenPrefix: token.tokenPrefix,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        revokedAt: token.revokedAt,
        createdByUserId: actingUserId,
        updatedByUserId: actingUserId
      };
      transaction.set(tokenRef, tokenData);
    });

    await this.recordAuditEntry(actingUserId, 'update', 'invitation', invitation.id);
    await this.recordAuditEntry(actingUserId, 'create', 'api_token', token.id);

    return { user, token, secret };
  }

  /**
   * Lists all collections ordered by name within the instance's tenant namespace.
   */
  async listCollections(): Promise<CollectionRecord[]> {
    const snapshot = await this.requireClient()
      .collection(COLLECTIONS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('name')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreCollection(doc.id, doc.data() as FirestoreCollectionDocument)
    );
  }

  /**
   * Creates a new collection with the given name within the instance's tenant namespace.
   *
   * @param name - Display name for the collection.
   * @param actingUserId - User performing the create action.
   */
  async createCollection(name: string, actingUserId: string): Promise<CollectionRecord> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const id = randomUUID();
    const now = new Date();
    const data: FirestoreCollectionDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimmedName,
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: '',
      postRequestScript: '',
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId,
      deletionLocked: false
    };

    await this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'collection', id);
    return mapFirestoreCollection(id, data);
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
    const docRef = this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Collection not found');
    }

    const existing = snapshot.data() as FirestoreCollectionDocument;
    const serializedMarker =
      marker !== undefined ? serializeSidebarMarker(marker) : existing.marker;
    const updated: FirestoreCollectionDocument = {
      ...existing,
      name: trimmedName,
      variables,
      headers,
      auth,
      preRequestScript,
      postRequestScript,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {})
    };

    await docRef.update({
      name: trimmedName,
      variables,
      headers,
      auth,
      preRequestScript,
      postRequestScript,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {})
    });

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);
    return mapFirestoreCollection(id, updated);
  }

  /**
   * Deletes a collection and all of its requests and folders within the instance's tenant namespace.
   *
   * @param id - Collection ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteCollection(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'collection', id);

    const client = this.requireClient();
    const requestsSnap = await client
      .collection(REQUESTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', id)
      .get();
    const documentsSnap = await client
      .collection(DOCUMENTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', id)
      .get();
    const foldersSnap = await client
      .collection(FOLDERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', id)
      .get();

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      ...documentsSnap.docs.map((documentDoc) => documentDoc.ref),
      ...foldersSnap.docs.map((folderDoc) => folderDoc.ref),
      client.collection(COLLECTIONS_COLLECTION).doc(id)
    ];

    await this.commitBatchedDeletes(refs);
  }

  /**
   * Finds a collection by stable identifier within the instance's tenant namespace.
   *
   * @param id - Collection ID to look up.
   */
  async findCollectionById(id: string): Promise<CollectionRecord | null> {
    const snapshot = await this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreCollectionDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreCollection(id, data as FirestoreCollectionDocument);
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
    const docRef = this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Collection not found');
    }

    const updatedAt = new Date();
    await docRef.update({
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'update', 'collection', id);

    const existing = snapshot.data() as FirestoreCollectionDocument;
    return mapFirestoreCollection(id, {
      ...existing,
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });
  }

  /**
   * Lists all environments ordered by name within the instance's tenant namespace.
   */
  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const snapshot = await this.requireClient()
      .collection(ENVIRONMENTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('name')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreEnvironment(doc.id, doc.data() as FirestoreEnvironmentDocument)
    );
  }

  /**
   * Creates a new environment with the given name within the instance's tenant namespace.
   *
   * @param name - Display name for the environment.
   * @param actingUserId - User performing the create action.
   */
  async createEnvironment(name: string, actingUserId: string): Promise<EnvironmentRecord> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const id = randomUUID();
    const now = new Date();
    const data: FirestoreEnvironmentDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimmedName,
      variables: [],
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId,
      deletionLocked: false,
      parentUuid: null
    };

    await this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'environment', id);
    return mapFirestoreEnvironment(id, data);
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
    const docRef = this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Environment not found');
    }

    const existing = snapshot.data() as FirestoreEnvironmentDocument;
    const serializedMarker =
      marker !== undefined ? serializeSidebarMarker(marker) : existing.marker;
    const normalizedParent = parentUuid === undefined ? undefined : parentUuid?.trim() || null;
    const updated: FirestoreEnvironmentDocument = {
      ...existing,
      name: trimmedName,
      variables,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {}),
      ...(normalizedParent === undefined ? {} : { parentUuid: normalizedParent })
    };

    await docRef.update({
      name: trimmedName,
      variables,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {}),
      ...(normalizedParent === undefined ? {} : { parentUuid: normalizedParent })
    });

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);
    return mapFirestoreEnvironment(id, updated);
  }

  /**
   * Deletes an environment and orphans any direct children within the instance's tenant namespace.
   *
   * @param id - Environment ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteEnvironment(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'environment', id);
    const client = this.requireClient();
    const children = await client
      .collection(ENVIRONMENTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('parentUuid', '==', id)
      .get();
    const batch = client.batch();
    for (const child of children.docs) {
      batch.update(child.ref, { parentUuid: null });
    }
    batch.delete(client.collection(ENVIRONMENTS_COLLECTION).doc(id));
    await batch.commit();
  }

  /**
   * Finds an environment by stable identifier within the instance's tenant namespace.
   *
   * @param id - Environment ID to look up.
   */
  async findEnvironmentById(id: string): Promise<EnvironmentRecord | null> {
    const snapshot = await this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreEnvironmentDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreEnvironment(id, data as FirestoreEnvironmentDocument);
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
    const docRef = this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Environment not found');
    }

    const updatedAt = new Date();
    await docRef.update({
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'update', 'environment', id);

    const existing = snapshot.data() as FirestoreEnvironmentDocument;
    return mapFirestoreEnvironment(id, {
      ...existing,
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });
  }

  /**
   * Lists all snippets ordered by sort order then name within the instance's tenant namespace.
   */
  async listSnippets(): Promise<SnippetRecord[]> {
    const snapshot = await this.requireClient()
      .collection(SNIPPETS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreSnippet(doc.id, doc.data() as FirestoreSnippetDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Creates a new snippet with the given fields within the instance's tenant namespace.
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
    const existing = await this.listSnippets();
    const maxOrder = existing.reduce((max, snippet) => Math.max(max, snippet.sortOrder), -1);
    const data: FirestoreSnippetDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimmedName,
      code,
      scope,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId,
      deletionLocked: false
    };

    await this.requireClient().collection(SNIPPETS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'snippet', id);
    return mapFirestoreSnippet(id, data);
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
    const docRef = this.requireClient().collection(SNIPPETS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Snippet not found');
    }

    const existing = snapshot.data() as FirestoreSnippetDocument;
    const updated: FirestoreSnippetDocument = {
      ...existing,
      name: trimmedName,
      code,
      scope,
      updatedAt,
      updatedByUserId: actingUserId
    };

    await docRef.update({
      name: trimmedName,
      code,
      scope,
      updatedAt,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);
    return mapFirestoreSnippet(id, updated);
  }

  /**
   * Deletes a snippet.
   *
   * @param id - Snippet ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteSnippet(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'snippet', id);
    await this.requireClient().collection(SNIPPETS_COLLECTION).doc(id).delete();
  }

  /**
   * Finds a snippet by stable identifier within the instance's tenant namespace.
   *
   * @param id - Snippet ID to look up.
   */
  async findSnippetById(id: string): Promise<SnippetRecord | null> {
    const snapshot = await this.requireClient().collection(SNIPPETS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreSnippetDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreSnippet(id, data as FirestoreSnippetDocument);
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
    const docRef = this.requireClient().collection(SNIPPETS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Snippet not found');
    }

    const updatedAt = new Date();
    await docRef.update({
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'update', 'snippet', id);

    const existing = snapshot.data() as FirestoreSnippetDocument;
    return mapFirestoreSnippet(id, {
      ...existing,
      deletionLocked,
      updatedAt,
      updatedByUserId: actingUserId
    });
  }

  /**
   * Lists live servers ordered by name.
   */
  async listLiveServers(): Promise<LiveServerRecord[]> {
    return this.listPayloadEntities(LIVE_SERVERS_COLLECTION, mapFirestoreLiveServer);
  }

  /**
   * Creates a live server.
   */
  async createLiveServer(
    input: CreateLiveServerRecordInput,
    actingUserId: string
  ): Promise<LiveServerRecord> {
    return this.createPayloadEntity(
      LIVE_SERVERS_COLLECTION,
      'live_server',
      input,
      actingUserId,
      mapFirestoreLiveServer
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
      LIVE_SERVERS_COLLECTION,
      'live_server',
      id,
      input,
      actingUserId,
      mapFirestoreLiveServer
    );
  }

  /**
   * Deletes a live server.
   */
  async deleteLiveServer(id: string, actingUserId: string): Promise<void> {
    await this.deletePayloadEntity(LIVE_SERVERS_COLLECTION, 'live_server', id, actingUserId);
  }

  /**
   * Finds a live server by id.
   */
  async findLiveServerById(id: string): Promise<LiveServerRecord | null> {
    return this.findPayloadEntity(LIVE_SERVERS_COLLECTION, id, mapFirestoreLiveServer);
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
      LIVE_SERVERS_COLLECTION,
      'live_server',
      id,
      deletionLocked,
      actingUserId,
      mapFirestoreLiveServer
    );
  }

  /**
   * Lists live pages ordered by name.
   */
  async listLivePages(): Promise<LivePageRecord[]> {
    return this.listPayloadEntities(LIVE_PAGES_COLLECTION, mapFirestoreLivePage);
  }

  /**
   * Creates a live page.
   */
  async createLivePage(
    input: CreateLivePageRecordInput,
    actingUserId: string
  ): Promise<LivePageRecord> {
    return this.createPayloadEntity(
      LIVE_PAGES_COLLECTION,
      'live_page',
      input,
      actingUserId,
      mapFirestoreLivePage
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
      LIVE_PAGES_COLLECTION,
      'live_page',
      id,
      input,
      actingUserId,
      mapFirestoreLivePage
    );
  }

  /**
   * Deletes a live page.
   */
  async deleteLivePage(id: string, actingUserId: string): Promise<void> {
    await this.deletePayloadEntity(LIVE_PAGES_COLLECTION, 'live_page', id, actingUserId);
  }

  /**
   * Finds a live page by id.
   */
  async findLivePageById(id: string): Promise<LivePageRecord | null> {
    return this.findPayloadEntity(LIVE_PAGES_COLLECTION, id, mapFirestoreLivePage);
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
      LIVE_PAGES_COLLECTION,
      'live_page',
      id,
      deletionLocked,
      actingUserId,
      mapFirestoreLivePage
    );
  }

  /**
   * Lists one of the fixed payload-entity collections within the instance's tenant namespace.
   */
  private async listPayloadEntities<T>(
    collection: string,
    mapper: (id: string, data: FirestorePayloadEntityDocument) => T
  ): Promise<T[]> {
    const snapshot = await this.requireClient()
      .collection(collection)
      .where('tenantId', '==', this.tenantId)
      .get();
    return snapshot.docs
      .map((doc) => mapper(doc.id, doc.data() as FirestorePayloadEntityDocument))
      .sort((left, right) => {
        const leftName = (left as { name: string }).name;
        const rightName = (right as { name: string }).name;
        return leftName.localeCompare(rightName);
      });
  }

  /**
   * Creates a JSON-payload Firestore entity within the instance's tenant namespace.
   */
  private async createPayloadEntity<T>(
    collection: string,
    entityType: 'live_server' | 'live_page',
    input: CreateLiveServerRecordInput,
    actingUserId: string,
    mapper: (id: string, data: FirestorePayloadEntityDocument) => T
  ): Promise<T> {
    const id = randomUUID();
    const now = new Date();
    const data: FirestorePayloadEntityDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimRequiredName(input.name, 'Entity name'),
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId,
      deletionLocked: false
    };
    await this.requireClient().collection(collection).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', entityType, id);
    return mapper(id, data);
  }

  /**
   * Replaces a JSON-payload Firestore entity.
   */
  private async updatePayloadEntity<T>(
    collection: string,
    entityType: 'live_server' | 'live_page',
    id: string,
    input: UpdateLiveServerRecordInput,
    actingUserId: string,
    mapper: (id: string, data: FirestorePayloadEntityDocument) => T
  ): Promise<T> {
    const ref = this.requireClient().collection(collection).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Entity not found');
    const data = snapshot.data() as FirestorePayloadEntityDocument;
    const updated = {
      ...data,
      name: trimRequiredName(input.name, 'Entity name'),
      payload: input.payload,
      updatedAt: new Date(),
      updatedByUserId: actingUserId
    };
    await ref.set(updated);
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    return mapper(id, updated);
  }

  /**
   * Deletes a JSON-payload Firestore entity.
   */
  private async deletePayloadEntity(
    collection: string,
    entityType: 'live_server' | 'live_page',
    id: string,
    actingUserId: string
  ): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', entityType, id);
    await this.requireClient().collection(collection).doc(id).delete();
  }

  /**
   * Finds one JSON-payload Firestore entity within the instance's tenant namespace.
   */
  private async findPayloadEntity<T>(
    collection: string,
    id: string,
    mapper: (id: string, data: FirestorePayloadEntityDocument) => T
  ): Promise<T | null> {
    const snapshot = await this.requireClient().collection(collection).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestorePayloadEntityDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapper(id, data as FirestorePayloadEntityDocument);
  }

  /**
   * Changes a JSON-payload Firestore entity deletion lock.
   */
  private async lockPayloadEntity<T>(
    collection: string,
    entityType: 'live_server' | 'live_page',
    id: string,
    deletionLocked: boolean,
    actingUserId: string,
    mapper: (id: string, data: FirestorePayloadEntityDocument) => T
  ): Promise<T> {
    const ref = this.requireClient().collection(collection).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('Entity not found');
    const updated = {
      ...(snapshot.data() as FirestorePayloadEntityDocument),
      deletionLocked,
      updatedAt: new Date(),
      updatedByUserId: actingUserId
    };
    await ref.set(updated);
    await this.recordAuditEntry(actingUserId, 'update', entityType, id);
    return mapper(id, updated);
  }

  /**
   * Lists all saved requests in a collection within the instance's tenant namespace.
   *
   * @param collectionId - Collection to query.
   */
  async listRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const snapshot = await this.requireClient()
      .collection(REQUESTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', collectionId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreRequest(doc.id, doc.data() as FirestoreRequestDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Finds a saved request by id within the instance's tenant namespace.
   *
   * @param id - Request identifier to look up.
   */
  async findRequestById(id: string): Promise<SavedRequestRecord | null> {
    const snapshot = await this.requireClient().collection(REQUESTS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreRequestDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreRequest(id, data as FirestoreRequestDocument);
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @param actingUserId - User performing the save action.
   */
  async saveRequest(input: SaveRequestInput, actingUserId: string): Promise<SavedRequestRecord> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const folderId = input.folderId ?? null;
    const serializedMarker = serializeSidebarMarker(input.marker ?? null);
    const now = new Date();
    const client = this.requireClient();

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const docRef = client.collection(REQUESTS_COLLECTION).doc(input.id);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const existing = snapshot.data() as FirestoreRequestDocument;
        const updated: FirestoreRequestDocument = {
          ...existing,
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          method: input.method,
          protocol: input.protocol === 'sse' ? 'sse' : 'http',
          url: input.url,
          headers: input.headers,
          params: input.params,
          auth: input.auth,
          body: input.body,
          bodyType: input.bodyType,
          preRequestScript: input.preRequestScript,
          postRequestScript: input.postRequestScript,
          comment: input.comment,
          marker: serializedMarker,
          updatedAt: now,
          updatedByUserId: actingUserId
        };

        await docRef.update({
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          method: input.method,
          protocol: input.protocol === 'sse' ? 'sse' : 'http',
          url: input.url,
          headers: input.headers,
          params: input.params,
          auth: input.auth,
          body: input.body,
          bodyType: input.bodyType,
          preRequestScript: input.preRequestScript,
          postRequestScript: input.postRequestScript,
          comment: input.comment,
          marker: serializedMarker,
          updatedAt: now,
          updatedByUserId: actingUserId
        });

        await this.recordAuditEntry(actingUserId, 'update', 'request', input.id);
        return mapFirestoreRequest(input.id, updated);
      }
    }

    const existingRequests = await this.listRequests(input.collectionId);
    const maxOrder = existingRequests
      .filter((request) => request.folderId === folderId)
      .reduce((max, request) => Math.max(max, request.sortOrder), -1);
    const id = randomUUID();
    const data: FirestoreRequestDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      collectionId: input.collectionId,
      folderId,
      name: trimmedName,
      method: input.method,
      protocol: input.protocol === 'sse' ? 'sse' : 'http',
      url: input.url,
      headers: input.headers,
      params: input.params,
      auth: input.auth,
      body: input.body,
      bodyType: input.bodyType,
      preRequestScript: input.preRequestScript,
      postRequestScript: input.postRequestScript,
      comment: input.comment,
      marker: serializedMarker,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await client.collection(REQUESTS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'request', id);
    return mapFirestoreRequest(id, data);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteRequest(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'request', id);
    await this.requireClient().collection(REQUESTS_COLLECTION).doc(id).delete();
  }

  /**
   * Lists all folders in a collection within the instance's tenant namespace.
   *
   * @param collectionId - Collection to query.
   */
  async listFolders(collectionId: string): Promise<FolderRecord[]> {
    const snapshot = await this.requireClient()
      .collection(FOLDERS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', collectionId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreFolder(doc.id, doc.data() as FirestoreFolderDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Finds a folder by id within the instance's tenant namespace.
   *
   * @param id - Folder identifier to look up.
   */
  async findFolderById(id: string): Promise<FolderRecord | null> {
    const snapshot = await this.requireClient().collection(FOLDERS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreFolderDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreFolder(id, data as FirestoreFolderDocument);
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
    const existingFolders = await this.listFolders(collectionId);
    const maxOrder = existingFolders
      .filter((folder) => folder.parentFolderId === parentFolderId)
      .reduce((max, folder) => Math.max(max, folder.sortOrder), -1);
    const data: FirestoreFolderDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      collectionId,
      parentFolderId,
      name: trimmedName,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await this.requireClient().collection(FOLDERS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'folder', id);
    return mapFirestoreFolder(id, data);
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
    const docRef = this.requireClient().collection(FOLDERS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Folder not found');
    }

    const existing = snapshot.data() as FirestoreFolderDocument;
    const serializedMarker =
      marker !== undefined ? serializeSidebarMarker(marker) : existing.marker;
    await docRef.update({
      name: trimmedName,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {})
    });
    await this.recordAuditEntry(actingUserId, 'update', 'folder', id);
    return mapFirestoreFolder(id, {
      ...existing,
      name: trimmedName,
      updatedAt,
      updatedByUserId: actingUserId,
      ...(marker !== undefined ? { marker: serializedMarker } : {})
    });
  }

  /**
   * Deletes a folder, its descendants, and their contents.
   *
   * @param id - Folder ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteFolder(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'folder', id);

    const client = this.requireClient();
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
    const requestSnapshots = await Promise.all(
      ids.map((folderId) =>
        client
          .collection(REQUESTS_COLLECTION)
          .where('tenantId', '==', this.tenantId)
          .where('folderId', '==', folderId)
          .get()
      )
    );
    const documentSnapshots = await Promise.all(
      ids.map((folderId) =>
        client
          .collection(DOCUMENTS_COLLECTION)
          .where('tenantId', '==', this.tenantId)
          .where('folderId', '==', folderId)
          .get()
      )
    );
    const refs = [
      ...requestSnapshots.flatMap((snapshot) => snapshot.docs.map((requestDoc) => requestDoc.ref)),
      ...documentSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((documentDoc) => documentDoc.ref)
      ),
      ...ids.map((folderId) => client.collection(FOLDERS_COLLECTION).doc(folderId))
    ];

    await this.commitBatchedDeletes(refs);
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
    const updatedAt = new Date();
    await this.requireClient().collection(FOLDERS_COLLECTION).doc(id).update({
      parentFolderId,
      updatedAt,
      updatedByUserId: actingUserId
    });
    await this.reorderFolders(
      folder.collectionId,
      parentFolderId,
      siblings.map((entry) => entry.id),
      actingUserId
    );
    return {
      ...folder,
      parentFolderId,
      sortOrder: index,
      updatedAt,
      updatedByUserId: actingUserId
    };
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
    const client = this.requireClient();
    const updatedAt = new Date();
    const batch = client.batch();

    for (let index = 0; index < orderedFolderIds.length; index++) {
      const docRef = client.collection(FOLDERS_COLLECTION).doc(orderedFolderIds[index]);
      batch.update(docRef, {
        sortOrder: index,
        collectionId,
        updatedAt,
        updatedByUserId: actingUserId
      });
    }

    await batch.commit();
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
    const client = this.requireClient();
    const updatedAt = new Date();
    const batch = client.batch();

    for (let index = 0; index < orderedRequestIds.length; index++) {
      const docRef = client.collection(REQUESTS_COLLECTION).doc(orderedRequestIds[index]);
      batch.update(docRef, {
        sortOrder: index,
        folderId,
        collectionId,
        updatedAt,
        updatedByUserId: actingUserId
      });
    }

    await batch.commit();
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
    const client = this.requireClient();
    const updatedAt = new Date();
    const requestSnap = await client.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!requestSnap.exists) {
      throw new Error('Request not found');
    }

    const request = mapFirestoreRequest(
      requestSnap.id,
      requestSnap.data() as FirestoreRequestDocument
    );
    const collectionId = request.collectionId;
    const oldFolderId = request.folderId;

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    /**
     * Lists request ids in a container ordered for reindexing.
     *
     * @param targetFolderId - Folder id or null for collection root.
     */
    const listInContainer = async (targetFolderId: string | null): Promise<string[]> => {
      const requests = await this.listRequests(collectionId);
      return requests
        .filter((item) => item.folderId === targetFolderId)
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name);
        })
        .map((item) => item.id);
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
      const batch = client.batch();
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        const docRef = client.collection(REQUESTS_COLLECTION).doc(orderedIds[sortIndex]);
        batch.update(docRef, {
          sortOrder: sortIndex,
          folderId: targetFolderId,
          updatedAt,
          updatedByUserId: actingUserId
        });
      }
      await batch.commit();
    };

    if (oldFolderId === folderId) {
      const siblings = (await listInContainer(folderId)).filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      await reindexContainer(folderId, siblings);
      await this.recordAuditEntry(actingUserId, 'move', 'request', requestId, {
        folderId,
        index
      });
      return;
    }

    const oldIds = (await listInContainer(oldFolderId)).filter((id) => id !== requestId);
    await reindexContainer(oldFolderId, oldIds);

    const newIds = (await listInContainer(folderId)).filter((id) => id !== requestId);
    newIds.splice(index, 0, requestId);
    await reindexContainer(folderId, newIds);

    await this.recordAuditEntry(actingUserId, 'move', 'request', requestId, {
      folderId,
      index
    });
  }

  /**
   * Lists all documents in a collection within the instance's tenant namespace.
   *
   * @param collectionId - Collection to query.
   */
  async listDocuments(collectionId: string): Promise<DocumentRecord[]> {
    const snapshot = await this.requireClient()
      .collection(DOCUMENTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('collectionId', '==', collectionId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreDocument(doc.id, doc.data() as FirestoreDocumentDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Finds a document by id within the instance's tenant namespace.
   *
   * @param id - Document identifier to look up.
   */
  async findDocumentById(id: string): Promise<DocumentRecord | null> {
    const snapshot = await this.requireClient().collection(DOCUMENTS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDocumentDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDocument(id, data as FirestoreDocumentDocument);
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
    const client = this.requireClient();

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const docRef = client.collection(DOCUMENTS_COLLECTION).doc(input.id);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const existing = snapshot.data() as FirestoreDocumentDocument;
        const updated: FirestoreDocumentDocument = {
          ...existing,
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          content: input.content,
          marker: serializedMarker,
          updatedAt: now,
          updatedByUserId: actingUserId
        };

        await docRef.update({
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          content: input.content,
          marker: serializedMarker,
          updatedAt: now,
          updatedByUserId: actingUserId
        });

        await this.recordAuditEntry(actingUserId, 'update', 'document', input.id);
        return mapFirestoreDocument(input.id, updated);
      }
    }

    const existingDocuments = await this.listDocuments(input.collectionId);
    const maxOrder = existingDocuments
      .filter((document) => document.folderId === folderId)
      .reduce((max, document) => Math.max(max, document.sortOrder), -1);
    const id = randomUUID();
    const data: FirestoreDocumentDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      collectionId: input.collectionId,
      folderId,
      name: trimmedName,
      content: input.content,
      marker: serializedMarker,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actingUserId,
      updatedByUserId: actingUserId
    };

    await client.collection(DOCUMENTS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'document', id);
    return mapFirestoreDocument(id, data);
  }

  /**
   * Deletes a document by ID.
   *
   * @param id - Document ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteDocument(id: string, actingUserId: string): Promise<void> {
    await this.recordAuditEntry(actingUserId, 'delete', 'document', id);
    await this.requireClient().collection(DOCUMENTS_COLLECTION).doc(id).delete();
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
    const client = this.requireClient();
    const updatedAt = new Date();
    const batch = client.batch();

    for (let index = 0; index < orderedDocumentIds.length; index++) {
      const docRef = client.collection(DOCUMENTS_COLLECTION).doc(orderedDocumentIds[index]);
      batch.update(docRef, {
        sortOrder: index,
        folderId,
        collectionId,
        updatedAt,
        updatedByUserId: actingUserId
      });
    }

    await batch.commit();
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
    const client = this.requireClient();
    const updatedAt = new Date();
    const documentSnap = await client.collection(DOCUMENTS_COLLECTION).doc(documentId).get();
    if (!documentSnap.exists) {
      throw new Error('Document not found');
    }

    const document = mapFirestoreDocument(
      documentSnap.id,
      documentSnap.data() as FirestoreDocumentDocument
    );
    const collectionId = document.collectionId;
    const oldFolderId = document.folderId;

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    /**
     * Lists document ids in a container ordered for reindexing.
     *
     * @param targetFolderId - Folder id or null for collection root.
     */
    const listInContainer = async (targetFolderId: string | null): Promise<string[]> => {
      const documents = await this.listDocuments(collectionId);
      return documents
        .filter((item) => item.folderId === targetFolderId)
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name);
        })
        .map((item) => item.id);
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
      const batch = client.batch();
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        const docRef = client.collection(DOCUMENTS_COLLECTION).doc(orderedIds[sortIndex]);
        batch.update(docRef, {
          sortOrder: sortIndex,
          folderId: targetFolderId,
          updatedAt,
          updatedByUserId: actingUserId
        });
      }
      await batch.commit();
    };

    if (oldFolderId === folderId) {
      const siblings = (await listInContainer(folderId)).filter((id) => id !== documentId);
      siblings.splice(index, 0, documentId);
      await reindexContainer(folderId, siblings);
      await this.recordAuditEntry(actingUserId, 'move', 'document', documentId, {
        folderId,
        index
      });
      return;
    }

    const oldIds = (await listInContainer(oldFolderId)).filter((id) => id !== documentId);
    await reindexContainer(oldFolderId, oldIds);

    const newIds = (await listInContainer(folderId)).filter((id) => id !== documentId);
    newIds.splice(index, 0, documentId);
    await reindexContainer(folderId, newIds);

    await this.recordAuditEntry(actingUserId, 'move', 'document', documentId, {
      folderId,
      index
    });
  }

  /**
   * Returns monthly LLM usage for a user within the instance's tenant namespace, or null when no usage has been recorded.
   *
   * @param userId - Owning user identifier.
   * @param period - UTC calendar month key (`YYYY-MM`).
   */
  async getLlmUsage(userId: string, period: string): Promise<LlmUsageRecord | null> {
    const docId = `${this.tenantId}_${userId}_${period}`;
    const snapshot = await this.requireClient().collection(LLM_USAGE_COLLECTION).doc(docId).get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreLlmUsageDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreLlmUsage(docId, data as FirestoreLlmUsageDocument);
  }

  /**
   * Atomically increments monthly LLM token usage for a user within the instance's tenant namespace.
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
    const docId = `${this.tenantId}_${userId}_${period}`;
    const docRef = this.requireClient().collection(LLM_USAGE_COLLECTION).doc(docId);
    const now = new Date();
    const totalDelta = promptTokens + completionTokens;

    await this.requireClient().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        const data: FirestoreLlmUsageDocument & { tenantId: string } = {
          tenantId: this.tenantId,
          userId,
          period,
          promptTokens,
          completionTokens,
          totalTokens: totalDelta,
          updatedAt: now
        };
        transaction.set(docRef, data);
        return;
      }

      const existing = snapshot.data() as FirestoreLlmUsageDocument;
      transaction.update(docRef, {
        promptTokens: existing.promptTokens + promptTokens,
        completionTokens: existing.completionTokens + completionTokens,
        totalTokens: existing.totalTokens + totalDelta,
        updatedAt: now
      });
    });

    const usage = await this.getLlmUsage(userId, period);
    if (!usage) {
      throw new Error('LLM usage not found after upsert');
    }

    return usage;
  }

  /**
   * Lists run results saved by the given user within the instance's tenant namespace, newest first.
   *
   * @param userId - Owning user identifier.
   */
  async listRunResultsForUser(userId: string): Promise<RunResultRecord[]> {
    const snapshot = await this.requireClient()
      .collection(RUN_RESULTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('createdByUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreRunResult(doc.id, doc.data() as FirestoreRunResultDocument)
    );
  }

  /**
   * Lists all run results for admin inspection within the instance's tenant namespace, newest first.
   */
  async listAllRunResults(): Promise<RunResultRecord[]> {
    const snapshot = await this.requireClient()
      .collection(RUN_RESULTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreRunResult(doc.id, doc.data() as FirestoreRunResultDocument)
    );
  }

  /**
   * Creates a standalone run result snapshot within the instance's tenant namespace.
   *
   * @param input - HarborClient export payload and optional label.
   * @param actingUserId - User performing the create action.
   */
  async createRunResult(
    input: CreateRunResultInput,
    actingUserId: string
  ): Promise<RunResultRecord> {
    const metadata = parseRunResultPayload(input.payload);
    const label = input.label?.trim() || buildDefaultRunResultLabel(metadata);
    const id = randomUUID();
    const now = new Date();
    const data: FirestoreRunResultDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      kind: metadata.kind,
      label,
      collectionName: metadata.collectionName,
      requestName: metadata.requestName,
      summary: metadata.summary,
      payload: input.payload,
      createdAt: now,
      createdByUserId: actingUserId
    };

    await this.requireClient().collection(RUN_RESULTS_COLLECTION).doc(id).set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'run_result', id);
    return mapFirestoreRunResult(id, data);
  }

  /**
   * Finds a run result by stable identifier within the instance's tenant namespace.
   *
   * @param id - Run result ID to look up.
   */
  async findRunResultById(id: string): Promise<RunResultRecord | null> {
    const snapshot = await this.requireClient().collection(RUN_RESULTS_COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreRunResultDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreRunResult(id, data as FirestoreRunResultDocument);
  }

  /**
   * Deletes a run result.
   *
   * @param id - Run result ID to delete.
   * @param actingUserId - User performing the delete action.
   */
  async deleteRunResult(id: string, actingUserId: string): Promise<void> {
    const docRef = this.requireClient().collection(RUN_RESULTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Run result not found');
    }

    await this.recordAuditEntry(actingUserId, 'delete', 'run_result', id);
    await docRef.delete();
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

    const data: FirestoreDiscussionCommentDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      targetEntityType: prepared.targetEntityType,
      targetEntityId: prepared.targetEntityId,
      parentCommentId: prepared.parentCommentId,
      rootCommentId: prepared.rootCommentId,
      depth: prepared.depth,
      body: prepared.body,
      bodyFormat: prepared.bodyFormat,
      bodyMetadata: prepared.bodyMetadata,
      authorUserId: prepared.authorUserId,
      createdAt: prepared.createdAt,
      updatedAt: prepared.updatedAt,
      tombstonedAt: null,
      tombstonedByUserId: null
    };

    await this.requireClient()
      .collection(DISCUSSION_COMMENTS_COLLECTION)
      .doc(prepared.id)
      .set(data);
    await this.recordAuditEntry(actingUserId, 'create', 'discussion_comment', prepared.id);
    return mapFirestoreDiscussionComment(prepared.id, data);
  }

  /**
   * Lists discussion comments for a target entity with cursor pagination.
   */
  async listDiscussionComments(
    options: ListDiscussionCommentsOptions
  ): Promise<ListDiscussionCommentsResult> {
    const limit = normalizeDiscussionListLimit(options.limit);
    const cursor = parseDiscussionListCursor(options.cursor);

    let query: Query = this.requireClient()
      .collection(DISCUSSION_COMMENTS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('targetEntityType', '==', options.targetEntityType)
      .where('targetEntityId', '==', options.targetEntityId)
      .orderBy('createdAt', 'asc');

    if (cursor) {
      query = query.where('createdAt', '>', cursor);
    }

    const snapshot = await query.limit(limit + 1).get();
    const rows = snapshot.docs.map((doc) => {
      const record = mapFirestoreDiscussionComment(
        doc.id,
        doc.data() as FirestoreDiscussionCommentDocument
      );
      return {
        id: record.id,
        target_entity_type: record.targetEntityType,
        target_entity_id: record.targetEntityId,
        parent_comment_id: record.parentCommentId,
        root_comment_id: record.rootCommentId,
        depth: record.depth,
        body: record.body,
        body_format: record.bodyFormat,
        body_metadata: record.bodyMetadata ? JSON.stringify(record.bodyMetadata) : null,
        author_user_id: record.authorUserId,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        tombstoned_at: record.tombstonedAt,
        tombstoned_by_user_id: record.tombstonedByUserId
      };
    });

    return buildDiscussionListResult(rows, limit);
  }

  /**
   * Finds a discussion comment by id within the current tenant.
   */
  async findDiscussionCommentById(id: string): Promise<DiscussionCommentRecord | null> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_COMMENTS_COLLECTION)
      .doc(id)
      .get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreDiscussionCommentDocument & { tenantId?: string };
    if (data.tenantId && data.tenantId !== this.tenantId) {
      return null;
    }

    return mapFirestoreDiscussionComment(id, data as FirestoreDiscussionCommentDocument);
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
    const docRef = this.requireClient().collection(DISCUSSION_COMMENTS_COLLECTION).doc(id);

    await docRef.update({
      body: normalized.body,
      bodyFormat: normalized.bodyFormat,
      bodyMetadata: normalized.bodyMetadata ?? undefined,
      updatedAt: now
    });

    await this.recordAuditEntry(actingUserId, 'update', 'discussion_comment', id);
    return mapFirestoreDiscussionComment(id, {
      ...existing,
      body: normalized.body,
      bodyFormat: normalized.bodyFormat,
      bodyMetadata: normalized.bodyMetadata,
      updatedAt: now
    });
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
    const docRef = this.requireClient().collection(DISCUSSION_COMMENTS_COLLECTION).doc(id);

    await docRef.update({
      body: '',
      updatedAt: now,
      tombstonedAt: now,
      tombstonedByUserId: actingUserId
    });

    await this.recordAuditEntry(actingUserId, 'delete', 'discussion_comment', id);
    return mapFirestoreDiscussionComment(id, {
      ...existing,
      body: '',
      updatedAt: now,
      tombstonedAt: now,
      tombstonedByUserId: actingUserId
    });
  }

  /**
   * Creates one or more collaboration notices for eligible recipients.
   */
  async createNotices(inputs: CreateNoticeInput[]): Promise<NoticeRecord[]> {
    const client = this.requireClient();
    const records: NoticeRecord[] = [];

    for (const input of inputs) {
      const id = randomUUID();
      const now = new Date();
      const data: FirestoreNoticeDocument & { tenantId: string } = {
        tenantId: this.tenantId,
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.requestId ?? null,
        collectionId: input.collectionId ?? null,
        folderId: input.folderId ?? null,
        runResultId: input.runResultId ?? null,
        discussionThreadId: input.discussionThreadId ?? null,
        discussionCommentId: input.discussionCommentId ?? null,
        actorUserId: input.actorUserId,
        createdAt: now,
        readAt: null,
        displayMetadata: input.displayMetadata as unknown as Record<string, unknown>
      };

      await client.collection(NOTICES_COLLECTION).doc(id).set(data);
      records.push(mapFirestoreNotice(id, data));
    }

    return records;
  }

  /**
   * Lists notices for a recipient with cursor pagination (newest first).
   */
  async listNotices(options: ListNoticesOptions): Promise<ListNoticesResult> {
    const limit = normalizeNoticeListLimit(options.limit);
    const cursor = parseNoticeListCursor(options.cursor);

    let query: Query = this.requireClient()
      .collection(NOTICES_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('recipientUserId', '==', options.recipientUserId)
      .orderBy('createdAt', 'desc');

    if (cursor) {
      query = query.where('createdAt', '<', cursor);
    }

    const snapshot = await query.limit(limit + 1).get();
    const rows: NoticeSqlRow[] = snapshot.docs.map((doc) => {
      const record = mapFirestoreNotice(doc.id, doc.data() as FirestoreNoticeDocument);
      return {
        id: record.id,
        recipient_user_id: record.recipientUserId,
        event_type: record.eventType,
        entity_type: record.entityType,
        entity_id: record.entityId,
        request_id: record.requestId,
        collection_id: record.collectionId,
        folder_id: record.folderId,
        run_result_id: record.runResultId,
        discussion_thread_id: record.discussionThreadId,
        discussion_comment_id: record.discussionCommentId,
        actor_user_id: record.actorUserId,
        created_at: record.createdAt,
        read_at: record.readAt,
        display_metadata: JSON.stringify(record.displayMetadata)
      };
    });

    return buildNoticeListResult(rows, limit);
  }

  /**
   * Counts unread notices for a recipient without loading the full feed.
   */
  async countUnreadNotices(recipientUserId: string): Promise<number> {
    const snapshot = await this.requireClient()
      .collection(NOTICES_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('recipientUserId', '==', recipientUserId)
      .where('readAt', '==', null)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Marks one notice read for the authenticated recipient.
   */
  async markNoticeRead(noticeId: string, recipientUserId: string): Promise<NoticeRecord | null> {
    const docRef = this.requireClient().collection(NOTICES_COLLECTION).doc(noticeId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as FirestoreNoticeDocument & { tenantId?: string };
    if (data.tenantId !== this.tenantId || data.recipientUserId !== recipientUserId) {
      return null;
    }

    const now = new Date();
    await docRef.update({ readAt: now });
    return mapFirestoreNotice(noticeId, { ...data, readAt: now });
  }

  /**
   * Marks all unread notices read for a recipient.
   */
  async markAllNoticesRead(recipientUserId: string): Promise<number> {
    const snapshot = await this.requireClient()
      .collection(NOTICES_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('recipientUserId', '==', recipientUserId)
      .where('readAt', '==', null)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const now = new Date();
    const batch = this.requireClient().batch();
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { readAt: now });
    }
    await batch.commit();
    return snapshot.size;
  }

  /**
   * Returns notification settings for a user, defaulting to `all` when unset.
   */
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettingsRecord> {
    const docRef = this.requireClient()
      .collection(USER_NOTIFICATION_SETTINGS_COLLECTION)
      .doc(`${this.tenantId}:${userId}`);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return { userId, level: 'all', updatedAt: new Date(0) };
    }

    const data = snapshot.data() as FirestoreUserNotificationSettingsDocument & {
      tenantId?: string;
    };
    if (data.tenantId !== this.tenantId) {
      return { userId, level: 'all', updatedAt: new Date(0) };
    }

    return mapFirestoreUserNotificationSettings(data);
  }

  /**
   * Updates notification settings for a user account.
   */
  async updateUserNotificationSettings(
    userId: string,
    level: NotificationLevel
  ): Promise<UserNotificationSettingsRecord> {
    const now = new Date();
    const data: FirestoreUserNotificationSettingsDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId,
      level,
      updatedAt: now
    };

    await this.requireClient()
      .collection(USER_NOTIFICATION_SETTINGS_COLLECTION)
      .doc(`${this.tenantId}:${userId}`)
      .set(data);

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
    const data: FirestoreDiscussionThreadSubscriptionDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId,
      rootCommentId,
      createdAt: now
    };

    await this.requireClient()
      .collection(DISCUSSION_THREAD_SUBSCRIPTIONS_COLLECTION)
      .doc(`${this.tenantId}:${userId}:${rootCommentId}`)
      .set(data);

    return mapFirestoreDiscussionThreadSubscription(data);
  }

  /**
   * Removes a user's subscription to a discussion thread.
   */
  async unsubscribeDiscussionThread(userId: string, rootCommentId: string): Promise<void> {
    await this.requireClient()
      .collection(DISCUSSION_THREAD_SUBSCRIPTIONS_COLLECTION)
      .doc(`${this.tenantId}:${userId}:${rootCommentId}`)
      .delete();
  }

  /**
   * Returns true when the user is subscribed to a discussion thread.
   */
  async isSubscribedToDiscussionThread(userId: string, rootCommentId: string): Promise<boolean> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_THREAD_SUBSCRIPTIONS_COLLECTION)
      .doc(`${this.tenantId}:${userId}:${rootCommentId}`)
      .get();
    return snapshot.exists;
  }

  /**
   * Lists user ids subscribed to a discussion thread.
   */
  async listDiscussionThreadSubscribers(rootCommentId: string): Promise<string[]> {
    const snapshot = await this.requireClient()
      .collection(DISCUSSION_THREAD_SUBSCRIPTIONS_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .where('rootCommentId', '==', rootCommentId)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreDiscussionThreadSubscriptionDocument;
      return data.userId;
    });
  }

  /**
   * Inserts a per-request LLM usage log entry within the instance's tenant namespace.
   *
   * @param input - Usage details for one successful completion step.
   */
  async createLlmUsageLog(input: CreateLlmUsageLogInput): Promise<LlmUsageLogRecord> {
    const id = randomUUID();
    const now = new Date();
    const data: FirestoreLlmUsageLogDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId: input.userId,
      apiTokenId: input.apiTokenId,
      period: input.period,
      model: input.model,
      provider: input.provider,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      isNewTurn: input.isNewTurn,
      hadToolCalls: input.hadToolCalls,
      messageCount: input.messageCount,
      createdAt: now
    };

    await this.requireClient().collection(LLM_USAGE_LOG_COLLECTION).doc(id).set(data);

    return mapFirestoreLlmUsageLog(id, data);
  }

  /**
   * Lists all per-request LLM usage log entries within the instance's tenant namespace, newest first.
   */
  async listLlmUsageLogs(): Promise<LlmUsageLogRecord[]> {
    const snapshot = await this.requireClient()
      .collection(LLM_USAGE_LOG_COLLECTION)
      .where('tenantId', '==', this.tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreLlmUsageLog(doc.id, doc.data() as FirestoreLlmUsageLogDocument)
    );
  }

  /**
   * Commits document deletes in Firestore-sized batches.
   *
   * @param refs - Document refs to delete.
   */
  private async commitBatchedDeletes(refs: DocumentReference[]): Promise<void> {
    const client = this.requireClient();

    for (let offset = 0; offset < refs.length; offset += WRITE_BATCH_LIMIT) {
      const batch = client.batch();
      for (const ref of refs.slice(offset, offset + WRITE_BATCH_LIMIT)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }

  /**
   * Ensures the internal system user exists within the instance's tenant namespace and caches its identifier.
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

    const input = createSystemUserInput();
    const id = randomUUID();
    const now = new Date();
    const trimmedName = trimRequiredName(input.name, 'User name');
    const avatar = buildUserAvatarFieldsForCreate(trimmedName, id, input);
    const data: FirestoreUserDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      name: trimmedName,
      role: input.role,
      collectionAccess: input.collectionAccess,
      environmentAccess: input.environmentAccess,
      snippetAccess: input.snippetAccess,
      liveServerAccess: input.liveServerAccess,
      livePageAccess: input.livePageAccess,
      llmAccess: false,
      llmModels: [],
      llmMonthlyTokenLimit: null,
      avatarInitials: avatar.avatarInitials,
      avatarColor: avatar.avatarColor,
      avatarImage: null,
      avatarImageKey: null,
      avatarImageMime: null,
      avatarImageUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: id,
      updatedByUserId: id
    };

    await this.requireClient().collection(USERS_COLLECTION).doc(id).set(data);
    this.systemUserId = id;
  }

  /**
   * Persists a single audit log entry for a mutating action within the instance's tenant namespace.
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
    const data: FirestoreAuditLogDocument & { tenantId: string } = {
      tenantId: this.tenantId,
      userId: actingUserId,
      userName,
      action,
      entityType,
      entityId,
      createdAt: now,
      metadata: metadata ?? null
    };

    await this.requireClient().collection(AUDIT_LOG_COLLECTION).doc(id).set(data);
  }

  /**
   * Returns the active Firestore client or throws when connect has not been called.
   *
   * @returns Connected Firestore client.
   * @throws {Error} When the database is not connected.
   */
  private requireClient(): Firestore {
    if (!this.client) {
      throw new Error('Firestore database is not connected.');
    }

    return this.client;
  }
}
