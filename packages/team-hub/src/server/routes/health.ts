import { z } from 'zod/v4';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import type { IThrottleStore } from '#/server/auth/throttle/IThrottleStore.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { isShuttingDown } from '#/server/shutdownState.js';

/**
 * Response body schema for `GET /health` and `GET /healthz`.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string()
});

/**
 * Per-dependency readiness outcome included in `GET /readyz`.
 */
export const readinessCheckSchema = z.object({
  status: z.enum(['ok', 'error']),
  error: z.string().optional()
});

/**
 * Response body schema for a successful `GET /readyz`.
 */
export const readinessOkResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  checks: z.object({
    db: readinessCheckSchema,
    redis: readinessCheckSchema,
    noticeEvents: readinessCheckSchema
  })
});

/**
 * Response body schema for a failed `GET /readyz`.
 */
export const readinessErrorResponseSchema = z.object({
  status: z.literal('error'),
  version: z.string(),
  checks: z.object({
    db: readinessCheckSchema,
    redis: readinessCheckSchema,
    noticeEvents: readinessCheckSchema
  })
});

/**
 * Dependencies required to evaluate readiness (DB, Redis, optional notice bus).
 */
export interface RegisterHealthRoutesOptions {
  /**
   * Application version included in probe responses.
   */
  version: string;

  /**
   * Live database handle used for readiness pings.
   */
  db: IDatabase;

  /**
   * Live Redis throttle store used for readiness pings.
   */
  throttleStore: IThrottleStore;

  /**
   * Notice event bus; Redis-backed buses are checked when pub/sub is enabled.
   */
  noticeEventBus?: INoticeEventBus;
}

/**
 * Outcome of one readiness dependency check.
 */
interface ReadinessCheckResult {
  /**
   * Whether the dependency responded successfully.
   */
  status: 'ok' | 'error';

  /**
   * Human-readable failure message when status is `error`.
   */
  error?: string;
}

/**
 * Formats an unknown readiness failure for the JSON response body.
 *
 * @param error - Caught dependency error.
 * @returns Message suitable for operators and orchestrator logs.
 */
function formatCheckError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Runs one async readiness check and maps failures to a structured result.
 *
 * @param check - Async probe that throws when the dependency is unhealthy.
 * @returns Structured ok/error result for the readiness payload.
 */
async function runReadinessCheck(check: () => Promise<void>): Promise<ReadinessCheckResult> {
  try {
    await check();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: formatCheckError(error) };
  }
}

/**
 * Verifies notice fan-out readiness when Redis pub/sub is enabled.
 *
 * In-memory buses always report ok so single-process deployments are not
 * marked unready solely because notice events do not use Redis.
 *
 * @param noticeEventBus - Active notice event bus from runtime context.
 * @returns Structured ok/error result for the readiness payload.
 */
async function checkNoticeEventBus(noticeEventBus: INoticeEventBus): Promise<ReadinessCheckResult> {
  if (!noticeEventBus.isRedisBacked()) {
    return { status: 'ok' };
  }

  return runReadinessCheck(() => noticeEventBus.ensureReady());
}

/**
 * Registers liveness, readiness, and legacy health routes for probes and clients.
 *
 * - `GET /health` — backward-compatible shallow check (same payload as `/healthz`)
 * - `GET /healthz` — liveness; process is up; never calls DB/Redis
 * - `GET /readyz` — readiness; requires DB + Redis, and Redis notice pub/sub when enabled
 *
 * @param app - Fastify server instance.
 * @param options - Version string and live dependency handles for readiness.
 */
export async function registerHealthRoute(
  app: FastifyInstance,
  options: RegisterHealthRoutesOptions
): Promise<void> {
  const { version, db, throttleStore } = options;
  const noticeEventBus = options.noticeEventBus ?? new InMemoryNoticeEventBus();
  const routes = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Builds the shallow health payload shared by `/health` and `/healthz`.
   *
   * @returns Status and version without touching downstream dependencies.
   */
  const shallowHealth = () => ({
    status: 'ok' as const,
    version
  });

  routes.route({
    method: 'GET',
    url: '/health',
    schema: {
      response: {
        200: healthResponseSchema
      }
    },
    /**
     * Returns the legacy health payload for load balancers and client pings.
     */
    handler: async (_request, reply) => {
      return reply.send(shallowHealth());
    }
  });

  routes.route({
    method: 'GET',
    url: '/healthz',
    schema: {
      response: {
        200: healthResponseSchema
      }
    },
    /**
     * Returns liveness status without checking DB, Redis, or notice pub/sub.
     */
    handler: async (_request, reply) => {
      return reply.send(shallowHealth());
    }
  });

  routes.route({
    method: 'GET',
    url: '/readyz',
    schema: {
      response: {
        200: readinessOkResponseSchema,
        503: readinessErrorResponseSchema
      }
    },
    /**
     * Returns readiness based on live DB, Redis, and optional notice pub/sub checks.
     *
     * Immediately fails when graceful shutdown has started so orchestrators stop
     * routing new traffic before SSE drain and connection teardown finish.
     */
    handler: async (_request, reply) => {
      if (isShuttingDown()) {
        return reply.code(503).send({
          status: 'error' as const,
          version,
          checks: {
            db: { status: 'error' as const, error: 'shutting down' },
            redis: { status: 'error' as const, error: 'shutting down' },
            noticeEvents: { status: 'error' as const, error: 'shutting down' }
          }
        });
      }

      const checks = {
        db: await runReadinessCheck(() => db.ping()),
        redis: await runReadinessCheck(() => throttleStore.ping()),
        noticeEvents: await checkNoticeEventBus(noticeEventBus)
      };

      const ready =
        checks.db.status === 'ok' &&
        checks.redis.status === 'ok' &&
        checks.noticeEvents.status === 'ok';

      if (!ready) {
        return reply.code(503).send({
          status: 'error' as const,
          version,
          checks
        });
      }

      return reply.send({
        status: 'ok' as const,
        version,
        checks
      });
    }
  });
}
