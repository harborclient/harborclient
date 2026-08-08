import type { FastifyInstance } from 'fastify';
import type { DocsConfig } from '#/config/docsConfig.js';
import type { LlmConfig } from '#/config/llmConfig.js';
import { DEFAULT_METRICS_CONFIG, type MetricsConfig } from '#/config/metricsConfig.js';
import {
  DEFAULT_MULTITENANCY_CONFIG,
  type MultitenancyConfig
} from '#/config/multitenancyConfig.js';
import {
  DEFAULT_COLLABORATION_CONFIG,
  type CollaborationConfig
} from '#/config/collaborationConfig.js';
import type { PluginsConfig } from '#/config/pluginsConfig.js';
import type { StorageConfig } from '#/config/storageConfig.js';
import { DEFAULT_STORAGE_CONFIG } from '#/config/storageConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { IThrottleStore } from '#/server/auth/throttle/IThrottleStore.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { setNoticeEventBus } from '#/server/notices/noticeService.js';
import { DbBlobStorage } from '#/storage/dbBlobStorage.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';
import {
  createBearerAuthHook,
  registerBearerAuthDecorator
} from '#/server/auth/bearerAuthPlugin.js';
import {
  createTenantAwareDatabase,
  createTenantResolutionHook,
  registerTenantDecorator
} from '#/server/auth/tenantContext.js';
import { registerMetricsRoute } from '#/server/metrics/registerMetricsRoute.js';
import { registerAdminRoutes } from '#/server/routes/admin.js';
import { registerAuthRoutes } from '#/server/routes/auth.js';
import { registerInvitationRoutes } from '#/server/routes/invitations.js';
import { registerCollectionRoutes } from '#/server/routes/collections.js';
import { registerEnvironmentRoutes } from '#/server/routes/environments.js';
import { registerSnippetRoutes } from '#/server/routes/snippets.js';
import { registerLiveServerRoutes } from '#/server/routes/liveServers.js';
import { registerLivePageRoutes } from '#/server/routes/livePages.js';
import { registerFolderRoutes } from '#/server/routes/folders.js';
import { registerDocumentRoutes } from '#/server/routes/documents.js';
import { registerHealthRoute } from '#/server/routes/health.js';
import { registerJoinRoute } from '#/server/routes/join.js';
import { registerRequestRoutes } from '#/server/routes/requests.js';
import { registerRunResultRoutes } from '#/server/routes/runResults.js';
import { registerDiscussionRoutes } from '#/server/routes/discussions.js';
import { registerDeviceKeyRoutes } from '#/server/routes/deviceKeys.js';
import { registerDiscussionMlsRoutes } from '#/server/routes/discussionMls.js';
import { setCollaborationConfigGetter } from '#/server/notices/noticeService.js';
import { registerNoticeRoutes } from '#/server/routes/notices.js';
import { registerNoticeStreamRoutes } from '#/server/routes/noticesStream.js';
import { registerLlmRoutes } from '#/server/routes/llm.js';
import { registerPluginsRoutes } from '#/server/routes/plugins.js';
import type { ReloadResult } from '#/server/runtimeContext.js';

export interface RegisterRoutesOptions {
  /**
   * Application version reported by the health endpoint.
   */
  version: string;

  /**
   * Root database used for tenant lookups and scoped via {@link IDatabase.forTenant}.
   */
  db: IDatabase;

  /**
   * Redis-backed store for authentication throttling on protected routes.
   */
  throttleStore: IThrottleStore;

  /**
   * Returns the current normalized LLM configuration from server.yaml.
   */
  getLlm: () => LlmConfig | null;

  /**
   * Returns the current normalized plugin source configuration from server.yaml.
   */
  getPlugins: () => PluginsConfig | null;

  /**
   * Returns the current normalized documentation search configuration from server.yaml.
   */
  getDocs: () => DocsConfig | null;

  /**
   * Returns the current normalized multitenancy configuration from server.yaml.
   */
  getMultitenancy: () => MultitenancyConfig;

  /**
   * Returns the current normalized collaboration configuration from server.yaml.
   */
  getCollaboration: () => CollaborationConfig;

  /**
   * Reloads server.yaml and returns a per-section report.
   */
  reloadConfig: () => Promise<ReloadResult>;

  /**
   * Fan-out bus for notice SSE events; defaults to in-memory for tests.
   */
  noticeEventBus?: INoticeEventBus;

  /**
   * Prometheus metrics settings; defaults enable `/metrics` when omitted.
   */
  metrics?: MetricsConfig;

  /**
   * Returns the active avatar storage configuration.
   */
  getStorage?: () => StorageConfig;

  /**
   * Blob storage client used when external avatar storage is enabled.
   */
  blobStorage?: IBlobStorage;
}

/**
 * Registers routes that do not require authentication.
 *
 * Health and join stay global. Invitation preview/redeem resolve a tenant so
 * invite codes stay isolated per tenant namespace.
 *
 * @param app - Fastify server or encapsulated scope.
 * @param options - Shared route metadata such as app version.
 */
export async function registerPublicRoutes(
  app: FastifyInstance,
  options: Pick<
    RegisterRoutesOptions,
    'version' | 'db' | 'throttleStore' | 'getMultitenancy' | 'noticeEventBus' | 'metrics'
  >
): Promise<void> {
  await registerHealthRoute(app, {
    version: options.version,
    db: options.db,
    throttleStore: options.throttleStore,
    noticeEventBus: options.noticeEventBus
  });
  await registerMetricsRoute(app, {
    metrics: options.metrics ?? DEFAULT_METRICS_CONFIG,
    db: options.db
  });
  await registerJoinRoute(app);

  await app.register(async (invitationApp) => {
    registerTenantDecorator(invitationApp);
    invitationApp.addHook(
      'onRequest',
      createTenantResolutionHook(options.db, options.getMultitenancy)
    );
    const tenantAwareDb = createTenantAwareDatabase(options.db);
    await registerInvitationRoutes(invitationApp, {
      db: tenantAwareDb,
      throttleStore: options.throttleStore
    });
  });
}

/**
 * Registers routes that require a valid bearer token.
 *
 * @param app - Encapsulated Fastify scope with bearer auth applied.
 * @param options - Shared route metadata and database access.
 */
export async function registerProtectedRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions
): Promise<void> {
  registerTenantDecorator(app);
  registerBearerAuthDecorator(app);
  app.addHook('onRequest', createTenantResolutionHook(options.db, options.getMultitenancy));
  const tenantAwareDb = createTenantAwareDatabase(options.db);
  app.addHook('onRequest', createBearerAuthHook(tenantAwareDb, options.throttleStore));

  const noticeEventBus = options.noticeEventBus ?? new InMemoryNoticeEventBus();
  setNoticeEventBus(noticeEventBus);
  setCollaborationConfigGetter(options.getCollaboration);

  const getStorage = options.getStorage ?? (() => DEFAULT_STORAGE_CONFIG);
  const blobStorage = options.blobStorage ?? new DbBlobStorage();

  await registerAuthRoutes(app, {
    db: tenantAwareDb,
    rootDb: options.db,
    getCollaboration: options.getCollaboration,
    getStorage,
    blobStorage
  });
  await registerAdminRoutes(app, {
    db: tenantAwareDb,
    getLlm: options.getLlm,
    reloadConfig: options.reloadConfig,
    getStorage,
    blobStorage
  });
  await registerCollectionRoutes(app, tenantAwareDb);
  await registerEnvironmentRoutes(app, tenantAwareDb);
  await registerSnippetRoutes(app, tenantAwareDb);
  await registerLiveServerRoutes(app, tenantAwareDb);
  await registerLivePageRoutes(app, tenantAwareDb);
  await registerFolderRoutes(app, tenantAwareDb);
  await registerRequestRoutes(app, tenantAwareDb);
  await registerDocumentRoutes(app, tenantAwareDb);
  await registerRunResultRoutes(app, tenantAwareDb);
  await registerDiscussionRoutes(app, tenantAwareDb, options.getCollaboration);
  await registerDeviceKeyRoutes(app, tenantAwareDb, options.getCollaboration);
  await registerDiscussionMlsRoutes(app, tenantAwareDb, options.getCollaboration);
  await registerNoticeRoutes(app, tenantAwareDb);
  await registerNoticeStreamRoutes(app, tenantAwareDb, noticeEventBus);
  await registerLlmRoutes(app, {
    db: tenantAwareDb,
    getLlm: options.getLlm,
    getDocs: options.getDocs
  });
  await registerPluginsRoutes(app, { getPlugins: options.getPlugins });
}

/**
 * Registers all HTTP routes on the Fastify instance.
 *
 * Public routes (such as health checks) and protected API routes are registered
 * in separate encapsulated scopes so authentication can be scoped correctly.
 *
 * @param app - Fastify server to attach routes to.
 * @param options - Shared route metadata and database access.
 */
export async function registerRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions
): Promise<void> {
  await app.register(async (publicApp) => {
    await registerPublicRoutes(publicApp, options);
  });

  await app.register(async (protectedApp) => {
    await registerProtectedRoutes(protectedApp, options);
  });
}

export function defaultGetCollaboration(): CollaborationConfig {
  return DEFAULT_COLLABORATION_CONFIG;
}

/**
 * Default multitenancy getter used by tests that omit an explicit config.
 */
export function defaultGetMultitenancy(): MultitenancyConfig {
  return DEFAULT_MULTITENANCY_CONFIG;
}
