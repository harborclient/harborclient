import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import { canUseDataApi } from '#/server/auth/accessControl.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { serializeNoticeStreamClientPayload } from '#/server/notices/noticeStreamTypes.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { errorResponseSchema } from '#/server/routes/schemas/common.js';

/**
 * Interval between SSE heartbeat comment frames.
 */
const NOTICE_STREAM_HEARTBEAT_MS = 30_000;

/**
 * Registers the authenticated notice SSE stream route.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param eventBus - Fan-out bus delivering notice events.
 */
export async function registerNoticeStreamRoute(
  app: FastifyInstance,
  eventBus: INoticeEventBus
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'GET',
    url: '/notices/stream',
    schema: {
      response: {
        403: errorResponseSchema,
        503: errorResponseSchema
      }
    },
    /**
     * Opens a long-lived SSE stream of compact notice events for the authenticated user.
     */
    handler: async (request, reply) => {
      const user = requireAuthenticatedUser(request);
      if (denyUnlessAllowed(reply, canUseDataApi(user))) {
        return;
      }

      try {
        await eventBus.ensureReady();
      } catch {
        void reply.code(503).send({ error: 'Service Unavailable' });
        return;
      }

      startNoticeStream(request, reply, eventBus, user.id);
    }
  });
}

/**
 * Writes SSE headers and forwards notice events until the client disconnects.
 *
 * @param request - Authenticated request with tenant context attached.
 * @param reply - Fastify reply hijacked for manual streaming.
 * @param eventBus - Fan-out bus delivering notice events.
 * @param userId - Authenticated user id receiving events.
 */
function startNoticeStream(
  request: FastifyRequest,
  reply: FastifyReply,
  eventBus: INoticeEventBus,
  userId: string
): void {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const tenantId = request.tenantId;
  const subscription = eventBus.subscribe(tenantId, userId, (event) => {
    const payload = serializeNoticeStreamClientPayload(event);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, NOTICE_STREAM_HEARTBEAT_MS);

  /**
   * Cleans up heartbeat timers and bus subscriptions when the client disconnects.
   */
  const cleanup = (): void => {
    clearInterval(heartbeat);
    subscription.unsubscribe();
  };

  request.raw.on('close', cleanup);
  request.raw.on('error', cleanup);
}

/**
 * Registers notice SSE routes that require a database handle for symmetry with other modules.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param _db - Tenant-scoped database (unused; auth already resolved the user).
 * @param eventBus - Fan-out bus delivering notice events.
 */
export async function registerNoticeStreamRoutes(
  app: FastifyInstance,
  _db: IDatabase,
  eventBus: INoticeEventBus
): Promise<void> {
  await registerNoticeStreamRoute(app, eventBus);
}
