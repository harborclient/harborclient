import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { UserRecord } from '#/db/types.js';
import {
  buildDiscussionMlsCommitRecord,
  buildDiscussionMlsWelcomeRecord,
  parseDiscussionMlsGroupId
} from '#/db/discussionMlsLogic.js';
import { canUseDataApi } from '#/server/auth/accessControl.js';
import { handleDbError, handleValidationError } from '#/server/routes/errors.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import {
  canAccessDiscussionTarget,
  resolveCollectionDiscussionTarget,
  resolveFolderDiscussionTarget,
  resolveRequestDiscussionTarget,
  resolveRunResultDiscussionTarget
} from '#/server/routes/discussionAccess.js';
import { denyUnlessDiscussionE2eeEnabled } from '#/server/routes/deviceKeys.js';
import { errorResponseSchema } from '#/server/routes/schemas/common.js';
import {
  createDiscussionMlsCommitBodySchema,
  createDiscussionMlsWelcomeBodySchema,
  discussionMlsCommitSchema,
  discussionMlsGroupStateSchema,
  discussionMlsWelcomeSchema,
  listDiscussionMlsCommitsQuerySchema,
  listDiscussionMlsCommitsResponseSchema,
  listDiscussionMlsWelcomesQuerySchema,
  listDiscussionMlsWelcomesResponseSchema,
  serializeDiscussionMlsCommit,
  serializeDiscussionMlsGroupState,
  serializeDiscussionMlsWelcome
} from '#/server/routes/schemas/discussionMls.js';

/**
 * Returns true when the handler should return early because access was denied.
 *
 * @param reply - Fastify reply used to short-circuit the handler.
 * @param db - Database handle scoped to the active tenant.
 * @param user - Authenticated user attached to the request.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 */
async function denyUnlessMlsGroupAccessible(
  reply: FastifyReply,
  db: IDatabase,
  user: UserRecord,
  mlsGroupId: string
): Promise<boolean> {
  const parsed = parseDiscussionMlsGroupId(mlsGroupId);
  if (!parsed) {
    void reply.code(400).send({ error: 'Invalid MLS group id' });
    return true;
  }

  let target = null;
  switch (parsed.targetEntityType) {
    case 'request':
      target = await resolveRequestDiscussionTarget(db, parsed.targetEntityId);
      break;
    case 'collection':
      target = await resolveCollectionDiscussionTarget(db, parsed.targetEntityId);
      break;
    case 'folder':
      target = await resolveFolderDiscussionTarget(db, parsed.targetEntityId);
      break;
    case 'runResult':
      target = await resolveRunResultDiscussionTarget(db, parsed.targetEntityId);
      break;
  }

  if (!target || denyUnlessAllowed(reply, canAccessDiscussionTarget(user, target))) {
    if (!target) {
      void reply.code(404).send({ error: 'Discussion target not found' });
    }
    return true;
  }

  return false;
}

/**
 * Registers bearer-protected MLS commit and welcome relay routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist MLS relay records.
 * @param getCollaboration - Returns active collaboration settings for E2EE gating.
 */
export async function registerDiscussionMlsRoutes(
  app: FastifyInstance,
  db: IDatabase,
  getCollaboration: () => CollaborationConfig
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'POST',
    url: '/discussion-mls/commits',
    schema: {
      body: createDiscussionMlsCommitBodySchema,
      response: {
        201: discussionMlsCommitSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema
      }
    },
    /**
     * Persists an MLS commit relay record for offline catch-up.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        if (await denyUnlessMlsGroupAccessible(reply, db, user, request.body.mlsGroupId)) {
          return;
        }

        const device = await db.findActiveDeviceKeyByUserAndDeviceId(
          user.id,
          request.body.senderDeviceId
        );
        if (!device) {
          void reply.code(403).send({ error: 'Sender device is not enrolled on this Team Hub' });
          return;
        }

        const record = buildDiscussionMlsCommitRecord(request.body, user.id);
        await db.createDiscussionMlsCommit(record, user.id);
        await db.upsertDiscussionMlsGroupState(
          {
            mlsGroupId: record.mlsGroupId,
            currentEpoch: record.epoch
          },
          user.id
        );

        return reply.code(201).send(serializeDiscussionMlsCommit(record));
      } catch (error) {
        if (handleValidationError(reply, error)) {
          return;
        }

        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'GET',
    url: '/discussion-mls/commits',
    schema: {
      querystring: listDiscussionMlsCommitsQuerySchema,
      response: {
        200: listDiscussionMlsCommitsResponseSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists MLS commits for a discussion thread in ascending epoch order.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        if (await denyUnlessMlsGroupAccessible(reply, db, user, request.query.mlsGroupId)) {
          return;
        }

        const result = await db.listDiscussionMlsCommits(request.query);
        return reply.send({
          commits: result.commits.map(serializeDiscussionMlsCommit),
          ...(result.nextCursor ? { nextCursor: result.nextCursor } : {})
        });
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'POST',
    url: '/discussion-mls/welcomes',
    schema: {
      body: createDiscussionMlsWelcomeBodySchema,
      response: {
        201: discussionMlsWelcomeSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Persists an MLS welcome relay record for a newly added device.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        if (await denyUnlessMlsGroupAccessible(reply, db, user, request.body.mlsGroupId)) {
          return;
        }

        const record = buildDiscussionMlsWelcomeRecord(request.body, user.id);
        await db.createDiscussionMlsWelcome(record, user.id);

        return reply.code(201).send(serializeDiscussionMlsWelcome(record));
      } catch (error) {
        if (handleValidationError(reply, error)) {
          return;
        }

        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'GET',
    url: '/discussion-mls/welcomes',
    schema: {
      querystring: listDiscussionMlsWelcomesQuerySchema,
      response: {
        200: listDiscussionMlsWelcomesResponseSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists MLS welcomes for a discussion thread, optionally filtered by recipient device.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        if (await denyUnlessMlsGroupAccessible(reply, db, user, request.query.mlsGroupId)) {
          return;
        }

        const result = await db.listDiscussionMlsWelcomes(request.query);
        return reply.send({
          welcomes: result.welcomes.map(serializeDiscussionMlsWelcome)
        });
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'GET',
    url: '/discussion-mls/group-state/:mlsGroupId',
    schema: {
      params: z.object({ mlsGroupId: z.string().min(1) }),
      response: {
        200: discussionMlsGroupStateSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Returns the latest MLS epoch observed for a discussion thread.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        if (await denyUnlessMlsGroupAccessible(reply, db, user, request.params.mlsGroupId)) {
          return;
        }

        const state = await db.getDiscussionMlsGroupState(request.params.mlsGroupId);
        if (!state) {
          void reply.code(404).send({ error: 'MLS group state not found' });
          return;
        }

        return reply.send(serializeDiscussionMlsGroupState(state));
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}
