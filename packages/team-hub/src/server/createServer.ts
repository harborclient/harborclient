import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { DEFAULT_LOGGING_CONFIG } from '#/config/loggingConfig.js';
import { DEFAULT_METRICS_CONFIG } from '#/config/metricsConfig.js';
import { DEFAULT_MULTITENANCY_CONFIG } from '#/config/multitenancyConfig.js';
import { DEFAULT_COLLABORATION_CONFIG } from '#/config/collaborationConfig.js';
import { DEFAULT_STORAGE_CONFIG } from '#/config/storageConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { IThrottleStore } from '#/server/auth/throttle/IThrottleStore.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { closeAllNoticeStreams } from '#/server/notices/noticeStreamRegistry.js';
import { registerHttpLogging } from '#/server/logging/httpLogging.js';
import { createLogger, type Logger } from '#/server/logging/logger.js';
import { registerHttpMetrics } from '#/server/metrics/registerHttpMetrics.js';
import { readPackageVersion } from '#/packageVersion.js';
import { registerRoutes } from '#/server/routes/index.js';
import type { ReloadResult, RuntimeContext } from '#/server/runtimeContext.js';
import { DbBlobStorage } from '#/storage/dbBlobStorage.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';

export interface CreateServerOptions {
  /**
   * When true, enables Fastify's built-in request logger.
   */
  verbose?: boolean;

  /**
   * Package version exposed on the health endpoint (defaults to package.json).
   */
  version?: string;

  /**
   * Database used for bearer token validation on protected routes.
   */
  db?: IDatabase;

  /**
   * Redis-backed store for authentication throttling on protected routes.
   */
  throttleStore?: IThrottleStore;

  /**
   * Notice event bus for SSE fan-out and readiness checks; overrides runtime context.
   */
  noticeEventBus?: INoticeEventBus;

  /**
   * Reloads server.yaml and returns a per-section report.
   */
  reloadConfig?: () => Promise<ReloadResult>;

  /**
   * Winston logger for HTTP request and error logging; defaults from config.
   */
  logger?: Logger;

  /**
   * Blob storage override for tests; defaults from runtime context or db driver.
   */
  blobStorage?: IBlobStorage;
}

/**
 * Builds a configured Fastify instance with Zod validation and registered routes.
 *
 * Does not call `listen`; use {@link runServer} or test inject for that.
 *
 * When a {@link RuntimeContext} is supplied, its stable db, throttle, and notice-bus
 * proxies are wired automatically. Explicit `db`, `throttleStore`, and `noticeEventBus`
 * options override those defaults for tests.
 *
 * @param ctxOrConfig - Runtime context, or legacy server config object for tests.
 * @param options - Logger, version, and optional dependency overrides.
 * @returns Fastify app with type provider and routes attached.
 */
export async function createServer(
  ctxOrConfig: RuntimeContext | import('#/config/serverConfig.js').ServerConfig,
  options: CreateServerOptions = {}
): Promise<FastifyInstance> {
  const isRuntimeContext = 'getLlm' in ctxOrConfig && 'configPath' in ctxOrConfig;
  const ctx = isRuntimeContext ? (ctxOrConfig as RuntimeContext) : null;
  const legacyConfig = isRuntimeContext
    ? null
    : (ctxOrConfig as import('#/config/serverConfig.js').ServerConfig);

  const db = options.db ?? ctx?.db;
  const throttleStore = options.throttleStore ?? ctx?.throttleStore;

  if (!db || !throttleStore) {
    throw new Error('createServer requires db and throttleStore.');
  }

  const loggingConfig = ctx?.logging ?? legacyConfig?.logging ?? DEFAULT_LOGGING_CONFIG;
  const metricsConfig = ctx?.metrics ?? legacyConfig?.metrics ?? DEFAULT_METRICS_CONFIG;
  const logger = options.logger ?? ctx?.logger ?? createLogger(loggingConfig);

  const app = Fastify({
    logger: options.verbose ?? false
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerHttpLogging(app, { logger, format: loggingConfig.format });

  if (metricsConfig.enabled) {
    registerHttpMetrics(app, { metricsPath: metricsConfig.path });
  }

  /**
   * Ends hijacked notice SSE streams before Fastify waits on open connections.
   *
   * Without this, `app.close()` can hang indefinitely while SSE heartbeats keep
   * sockets open.
   */
  app.addHook('preClose', async () => {
    closeAllNoticeStreams();
  });

  await registerRoutes(app, {
    version: options.version ?? readPackageVersion(),
    db,
    throttleStore,
    noticeEventBus: options.noticeEventBus ?? ctx?.noticeEventBus,
    metrics: metricsConfig,
    getLlm: ctx ? () => ctx.getLlm() : () => legacyConfig?.llm ?? null,
    getPlugins: ctx ? () => ctx.getPlugins() : () => legacyConfig?.plugins ?? null,
    getDocs: ctx ? () => ctx.getDocs() : () => legacyConfig?.docs ?? null,
    getMultitenancy: ctx
      ? () => ctx.getMultitenancy()
      : () => legacyConfig?.multitenancy ?? DEFAULT_MULTITENANCY_CONFIG,
    getCollaboration: ctx
      ? () => ctx.getCollaboration()
      : () => legacyConfig?.collaboration ?? DEFAULT_COLLABORATION_CONFIG,
    getStorage: ctx
      ? () => ctx.getStorage()
      : () => legacyConfig?.storage ?? DEFAULT_STORAGE_CONFIG,
    blobStorage: options.blobStorage ?? ctx?.blobStorage ?? new DbBlobStorage(),
    reloadConfig: options.reloadConfig ?? (async () => ({ sections: [] }))
  });

  return app;
}
