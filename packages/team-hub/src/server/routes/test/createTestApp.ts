import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import Fastify, { type FastifyInstance } from 'fastify';
import { type Mocked } from 'vitest';
import type { MultitenancyConfig } from '#/config/multitenancyConfig.js';
import { DEFAULT_MULTITENANCY_CONFIG } from '#/config/multitenancyConfig.js';
import {
  DEFAULT_COLLABORATION_CONFIG,
  type CollaborationConfig
} from '#/config/collaborationConfig.js';
import type { StorageConfig } from '#/config/storageConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord, UserRecord } from '#/db/types.js';
import { hashToken } from '#/server/auth/apiTokens.js';
import type { IThrottleStore } from '#/server/auth/throttle/IThrottleStore.js';
import { createStubThrottleStore } from '#/server/auth/throttle/stubThrottleStore.js';
import { registerProtectedRoutes } from '#/server/routes/index.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';
import type { ReloadResult } from '#/server/runtimeContext.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';

export const validBearerToken = 'hbk_valid-token';

/**
 * Sample user record used by protected route tests.
 */
export const sampleUserRecord: UserRecord = {
  id: 'user-1',
  name: 'Test user',
  role: 'user',
  collectionAccess: ['*'],
  environmentAccess: ['*'],
  snippetAccess: ['*'],
  liveServerAccess: ['*'],
  livePageAccess: ['*'],
  llmAccess: false,
  llmModels: [],
  llmMonthlyTokenLimit: null,
  avatarInitials: 'TU',
  avatarColor: 'sky-600',
  avatarImage: null,
  avatarImageKey: null,
  avatarImageMime: null,
  avatarImageUpdatedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...sampleAttribution
};

/**
 * Sample API token record matching {@link validBearerToken}.
 */
export const sampleApiTokenRecord: ApiTokenRecord = {
  id: 'token-1',
  userId: sampleUserRecord.id,
  name: 'Test token',
  tokenHash: hashToken(validBearerToken),
  tokenPrefix: 'hbk_valid-',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
  ...sampleAttribution
};

/**
 * Options for building a protected-route test Fastify instance.
 */
export interface CreateProtectedTestAppOptions {
  /**
   * Database stub wired into bearer auth and entity routes.
   */
  db: Mocked<IDatabase>;

  /**
   * Throttle store stub wired into bearer auth; defaults to a permissive stub.
   */
  throttleStore?: Mocked<IThrottleStore>;

  /**
   * When true, configures auth lookup to accept {@link validBearerToken}.
   */
  withValidAuth?: boolean;

  /**
   * User record returned by auth lookup; defaults to {@link sampleUserRecord}.
   */
  user?: UserRecord;

  /**
   * LLM configuration passed to protected routes; defaults to null (LLM disabled).
   */
  llm?: import('#/config/llmConfig.js').LlmConfig | null;

  /**
   * Plugin source configuration passed to protected routes; defaults to null.
   */
  plugins?: import('#/config/pluginsConfig.js').PluginsConfig | null;

  /**
   * Documentation search configuration passed to protected routes; defaults to null.
   */
  docs?: import('#/config/docsConfig.js').DocsConfig | null;

  /**
   * Multitenancy configuration; defaults to disabled.
   */
  multitenancy?: MultitenancyConfig;

  /**
   * Collaboration configuration; defaults to plaintext discussions.
   */
  collaboration?: CollaborationConfig;

  /**
   * Config reload handler for admin reload route tests.
   */
  reloadConfig?: () => Promise<ReloadResult>;

  /**
   * Notice event bus used by notice SSE routes.
   */
  noticeEventBus?: import('#/server/notices/INoticeEventBus.js').INoticeEventBus;

  /**
   * Avatar storage configuration for redirect tests.
   */
  storage?: StorageConfig;

  /**
   * Blob storage client for redirect tests.
   */
  blobStorage?: IBlobStorage;
}

/**
 * Builds a Fastify app with protected entity routes and optional valid bearer auth.
 *
 * @param options - Database stub and auth configuration.
 * @returns Fastify instance ready for inject-based route tests.
 */
export async function createProtectedTestApp(
  options: CreateProtectedTestAppOptions
): Promise<FastifyInstance> {
  const user = options.user ?? sampleUserRecord;
  const throttleStore = options.throttleStore ?? createDefaultThrottleStoreStub();
  const llm = options.llm ?? null;
  const plugins = options.plugins ?? null;
  const docs = options.docs ?? null;
  const multitenancy = options.multitenancy ?? DEFAULT_MULTITENANCY_CONFIG;
  const collaboration = options.collaboration ?? DEFAULT_COLLABORATION_CONFIG;

  options.db.forTenant.mockImplementation(() => options.db);
  options.db.getTenantId.mockReturnValue('__default__');

  if (options.withValidAuth) {
    options.db.findActiveApiTokenByHash.mockResolvedValue(sampleApiTokenRecord);
    options.db.findUserById.mockResolvedValue(user);
    options.db.touchApiTokenLastUsed.mockResolvedValue(undefined);
  }

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(async (protectedApp) => {
    await registerProtectedRoutes(protectedApp, {
      version: '0.1.0',
      db: options.db,
      throttleStore,
      getLlm: () => llm,
      getPlugins: () => plugins,
      getDocs: () => docs,
      getMultitenancy: () => multitenancy,
      getCollaboration: () => collaboration,
      reloadConfig: options.reloadConfig ?? (async () => ({ sections: [] })),
      noticeEventBus: options.noticeEventBus,
      ...(options.storage ? { getStorage: () => options.storage! } : {}),
      ...(options.blobStorage ? { blobStorage: options.blobStorage } : {})
    });
  });

  return app;
}

/**
 * Authorization header value for {@link validBearerToken}.
 */
export function authHeader(): { authorization: string } {
  return { authorization: `Bearer ${validBearerToken}` };
}

/**
 * Creates a permissive throttle store stub for route tests.
 */
function createDefaultThrottleStoreStub(): Mocked<IThrottleStore> {
  const throttleStore = createStubThrottleStore();
  throttleStore.isBlocked.mockResolvedValue(false);
  throttleStore.recordFailure.mockResolvedValue(false);
  throttleStore.reset.mockResolvedValue(undefined);
  return throttleStore;
}
