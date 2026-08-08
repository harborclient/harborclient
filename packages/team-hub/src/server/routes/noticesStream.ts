import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import { canUseDataApi } from '#/server/auth/accessControl.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { registerNoticeStream } from '#/server/notices/noticeStreamRegistry.js';
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
 * Writes SSE headers and forwards notice events until the client disconnects or the server shuts down.
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
  // Flush headers immediately so clients (and tests) observe the open stream.
  reply.raw.write(': connected\n\n');

  const tenantId = request.tenantId;
  const subscription = eventBus.subscribe(tenantId, userId, (event) => {
    if (reply.raw.writableEnded) {
      return;
    }
    const payload = serializeNoticeStreamClientPayload(event);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    if (reply.raw.writableEnded) {
      return;
    }
    reply.raw.write(': heartbeat\n\n');
  }, NOTICE_STREAM_HEARTBEAT_MS);

  let cleaned = false;
  const registryEntry = {
    unregister: (): void => undefined
  };

  /**
   * Cleans up heartbeat timers, bus subscriptions, and the socket when the client
   * disconnects or the server initiates graceful shutdown.
   *
   * @param options - Whether this cleanup is a server-initiated shutdown.
   */
  const cleanup = (options: { serverShutdown?: boolean } = {}): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    clearInterval(heartbeat);
    subscription.unsubscribe();
    registryEntry.unregister();

    if (!reply.raw.writableEnded) {
      if (options.serverShutdown) {
        try {
          reply.raw.write(': shutdown\n\n');
        } catch {
          // Ignore write errors while ending the stream.
        }
      }
      reply.raw.end();
    }
  };

  /**
   * Registry entry invoked from Fastify `preClose` during process shutdown.
   */
  const shutdownCleanup = (): void => {
    cleanup({ serverShutdown: true });
  };

  registryEntry.unregister = registerNoticeStream(shutdownCleanup);

  request.raw.on('close', () => {
    cleanup();
  });
  request.raw.on('error', () => {
    cleanup();
  });
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
