import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import { DeletionLockedError } from '#/db/deletionLockedError.js';
import {
  canAccessLiveServer,
  canCreateLiveServer,
  canListLiveServers,
  filterAccessibleLiveServers
} from '#/server/auth/accessControl.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { handleDbError } from '#/server/routes/errors.js';
import { errorResponseSchema, idParamSchema } from '#/server/routes/schemas/common.js';
import {
  emptyResponseSchema,
  listLiveServersResponseSchema,
  liveServerBodySchema,
  liveServerRecordSchema,
  payloadEntityInput,
  serializeLiveServer
} from '#/server/routes/schemas/entities.js';

/**
 * Registers bearer-protected live server CRUD routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist live servers.
 */
export async function registerLiveServerRoutes(app: FastifyInstance, db: IDatabase): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get(
    '/live-servers',
    { schema: { response: { 200: listLiveServersResponseSchema } } },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canListLiveServers(user))) return;
        const records = await db.listLiveServers();
        return reply.send({
          liveServers: filterAccessibleLiveServers(user, records).map(serializeLiveServer)
        });
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.post(
    '/live-servers',
    {
      schema: {
        body: liveServerBodySchema,
        response: { 200: liveServerRecordSchema, 400: errorResponseSchema }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canCreateLiveServer(user))) return;
        return reply.send(
          serializeLiveServer(await db.createLiveServer(payloadEntityInput(request.body), user.id))
        );
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.put(
    '/live-servers/:id',
    {
      schema: {
        params: idParamSchema,
        body: liveServerBodySchema,
        response: {
          200: liveServerRecordSchema,
          400: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canAccessLiveServer(user, request.params.id))) return;
        return reply.send(
          serializeLiveServer(
            await db.updateLiveServer(request.params.id, payloadEntityInput(request.body), user.id)
          )
        );
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.delete(
    '/live-servers/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 204: emptyResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canAccessLiveServer(user, request.params.id))) return;
        const record = await db.findLiveServerById(request.params.id);
        if (!record) return reply.code(404).send({ error: 'Live server not found' });
        if (record.deletionLocked) throw new DeletionLockedError('live server');
        await db.deleteLiveServer(record.id, user.id);
        return reply.code(204).send(null);
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
}
