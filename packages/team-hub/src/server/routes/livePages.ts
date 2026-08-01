import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import { DeletionLockedError } from '#/db/deletionLockedError.js';
import {
  canAccessLivePage,
  canCreateLivePage,
  canListLivePages,
  filterAccessibleLivePages
} from '#/server/auth/accessControl.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { handleDbError } from '#/server/routes/errors.js';
import { errorResponseSchema, idParamSchema } from '#/server/routes/schemas/common.js';
import {
  emptyResponseSchema,
  listLivePagesResponseSchema,
  livePageBodySchema,
  livePageRecordSchema,
  payloadEntityInput,
  serializeLivePage
} from '#/server/routes/schemas/entities.js';

/**
 * Registers bearer-protected Live Page (Website) CRUD routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist live pages.
 */
export async function registerLivePageRoutes(app: FastifyInstance, db: IDatabase): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  routes.get(
    '/live-pages',
    { schema: { response: { 200: listLivePagesResponseSchema } } },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canListLivePages(user))) return;
        const records = await db.listLivePages();
        return reply.send({
          livePages: filterAccessibleLivePages(user, records).map(serializeLivePage)
        });
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.post(
    '/live-pages',
    {
      schema: {
        body: livePageBodySchema,
        response: { 200: livePageRecordSchema, 400: errorResponseSchema }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canCreateLivePage(user))) return;
        return reply.send(
          serializeLivePage(await db.createLivePage(payloadEntityInput(request.body), user.id))
        );
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.put(
    '/live-pages/:id',
    {
      schema: {
        params: idParamSchema,
        body: livePageBodySchema,
        response: { 200: livePageRecordSchema, 400: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canAccessLivePage(user, request.params.id))) return;
        return reply.send(
          serializeLivePage(
            await db.updateLivePage(request.params.id, payloadEntityInput(request.body), user.id)
          )
        );
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
  routes.delete(
    '/live-pages/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 204: emptyResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canAccessLivePage(user, request.params.id))) return;
        const record = await db.findLivePageById(request.params.id);
        if (!record) return reply.code(404).send({ error: 'Live page not found' });
        if (record.deletionLocked) throw new DeletionLockedError('live page');
        await db.deleteLivePage(record.id, user.id);
        return reply.code(204).send(null);
      } catch (error) {
        if (!handleDbError(reply, error)) throw error;
      }
    }
  );
}
