import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  isDefaultTenantId,
  resolveRequestTenantId,
  TENANT_HEADER_NAME,
  type MultitenancyConfig
} from '#/config/multitenancyConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Effective tenant id for this request (`__default__` when unspecified).
     */
    tenantId: string;

    /**
     * Database handle scoped to {@link FastifyRequest.tenantId}.
     */
    db: IDatabase;
  }
}

/**
 * Holds the tenant-scoped database for the current request async context.
 */
const tenantDatabaseStorage = new AsyncLocalStorage<IDatabase>();

/**
 * Returns the tenant-scoped database for the current async context, when set.
 */
export function getActiveTenantDatabase(): IDatabase | undefined {
  return tenantDatabaseStorage.getStore();
}

/**
 * Creates a database proxy that forwards entity operations to the active
 * request-scoped tenant database when one is set via {@link createTenantResolutionHook}.
 *
 * Tenant registry and connection lifecycle methods always use the root database.
 *
 * @param rootDb - Unscoped root database handle from server startup.
 * @returns Proxy implementing {@link IDatabase} for route registration closures.
 */
export function createTenantAwareDatabase(rootDb: IDatabase): IDatabase {
  /**
   * Methods that must always run against the root (unscoped) database.
   */
  const rootMethods = new Set<PropertyKey>([
    'connect',
    'disconnect',
    'migrate',
    'getTenantId',
    'forTenant',
    'ensureDefaultTenant',
    'listTenants',
    'createTenant',
    'findTenantById',
    'deleteTenant'
  ]);

  return new Proxy(rootDb, {
    /**
     * Forwards property access to the request-scoped database when present.
     *
     * @param target - Root database instance.
     * @param prop - Property being accessed.
     */
    get(target, prop) {
      const active =
        rootMethods.has(prop) || prop === 'then' ? target : (getActiveTenantDatabase() ?? target);
      const value = Reflect.get(active as object, prop, active);
      if (typeof value === 'function') {
        return value.bind(active);
      }
      return value;
    }
  });
}

/**
 * Registers tenant-related request decorators used by tenant-aware routes.
 *
 * @param app - Fastify instance or encapsulated scope to decorate.
 */
export function registerTenantDecorator(app: FastifyInstance): void {
  app.decorateRequest('tenantId', '');
  app.decorateRequest('db', null as unknown as IDatabase);
}

/**
 * Reads the raw `X-Harbor-Tenant` header value from a request.
 *
 * @param request - Incoming HTTP request.
 * @returns Header string, or undefined when absent.
 */
export function readTenantHeader(request: FastifyRequest): string | undefined {
  const raw = request.headers[TENANT_HEADER_NAME];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

/**
 * Builds an onRequest hook that resolves the request tenant and scopes the database.
 *
 * Missing headers resolve to `__default__`. When multitenancy is disabled, non-default
 * tenants are rejected with HTTP 400. When enabled, unknown tenants return HTTP 404.
 *
 * @param rootDb - Root database used for tenant lookups and {@link IDatabase.forTenant}.
 * @param getMultitenancy - Returns the current multitenancy config.
 * @returns Hook that attaches `request.tenantId` / `request.db` or short-circuits.
 */
export function createTenantResolutionHook(
  rootDb: IDatabase,
  getMultitenancy: () => MultitenancyConfig
) {
  /**
   * Resolves the tenant for the current request and binds a scoped database.
   *
   * @param request - Incoming HTTP request.
   * @param reply - Fastify reply used to short-circuit invalid tenant selection.
   */
  return async function resolveTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    let tenantId: string;
    try {
      tenantId = resolveRequestTenantId(readTenantHeader(request), getMultitenancy());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid tenant.';
      return reply.code(400).send({ error: message });
    }

    if (!isDefaultTenantId(tenantId)) {
      const tenant = await rootDb.findTenantById(tenantId);
      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant not found' });
      }
    }

    const scopedDb = rootDb.forTenant(tenantId);
    request.tenantId = tenantId;
    request.db = scopedDb;
    tenantDatabaseStorage.enterWith(scopedDb);
  };
}
