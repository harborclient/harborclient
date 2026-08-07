import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { DiscussionCommentRecord } from '#/db/types.js';
import { DiscussionCommentForbiddenError } from '#/db/discussionCommentErrors.js';
import { handleDbError } from '#/server/routes/errors.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import {
  canAccessDiscussionTarget,
  canDeleteDiscussionComment,
  resolveCollectionDiscussionTarget,
  resolveDiscussionAuthors,
  resolveFolderDiscussionTarget,
  resolveRequestDiscussionTarget,
  resolveRunResultDiscussionTarget,
  type DiscussionTargetContext
} from '#/server/routes/discussionAccess.js';
import { errorResponseSchema, idParamSchema } from '#/server/routes/schemas/common.js';
import {
  createDiscussionCommentBodySchema,
  createDiscussionReplyBodySchema,
  discussionCommentSchema,
  listDiscussionCommentsQuerySchema,
  listDiscussionCommentsResponseSchema,
  serializeDiscussionComment,
  updateDiscussionCommentBodySchema
} from '#/server/routes/schemas/discussions.js';
import {
  serializeDiscussionAuthor,
  serializeUnknownDiscussionAuthor
} from '#/server/routes/schemas/userAuthor.js';
import { createNoticeService } from '#/server/notices/noticeService.js';
import { parseDiscussionWriteBody } from '#/server/routes/discussionWriteBody.js';

/**
 * Serializes a page of discussion comments with author metadata.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param comments - Comment records to serialize.
 * @returns REST payloads with author display metadata.
 */
async function serializeDiscussionComments(
  db: IDatabase,
  comments: DiscussionCommentRecord[],
  collaboration: CollaborationConfig
) {
  const authorIds = [
    ...new Set(comments.map((comment) => comment.authorUserId).filter(Boolean) as string[])
  ];
  const authors = await resolveDiscussionAuthors(db, authorIds);

  return comments.map((comment) => {
    const author = comment.authorUserId != null ? authors.get(comment.authorUserId) : undefined;

    return serializeDiscussionComment(
      comment,
      author != null
        ? serializeDiscussionAuthor(author)
        : serializeUnknownDiscussionAuthor(comment.authorUserId),
      collaboration
    );
  });
}

/**
 * Registers bearer-protected discussion comment routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist discussion comments.
 * @param getCollaboration - Returns active collaboration settings for E2EE enforcement.
 */
export async function registerDiscussionRoutes(
  app: FastifyInstance,
  db: IDatabase,
  getCollaboration: () => CollaborationConfig
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  registerEntityDiscussionRoutes(routes, db, getCollaboration, {
    method: 'GET',
    listUrl: '/requests/:id/discussions',
    createUrl: '/requests/:id/discussions',
    resolveTarget: (requestId) => resolveRequestDiscussionTarget(db, requestId)
  });

  registerEntityDiscussionRoutes(routes, db, getCollaboration, {
    method: 'GET',
    listUrl: '/collections/:id/discussions',
    createUrl: '/collections/:id/discussions',
    resolveTarget: (collectionId) => resolveCollectionDiscussionTarget(db, collectionId)
  });

  registerEntityDiscussionRoutes(routes, db, getCollaboration, {
    method: 'GET',
    listUrl: '/folders/:id/discussions',
    createUrl: '/folders/:id/discussions',
    resolveTarget: (folderId) => resolveFolderDiscussionTarget(db, folderId)
  });

  registerEntityDiscussionRoutes(routes, db, getCollaboration, {
    method: 'GET',
    listUrl: '/run-results/:id/discussions',
    createUrl: '/run-results/:id/discussions',
    resolveTarget: (runResultId) => resolveRunResultDiscussionTarget(db, runResultId)
  });

  routes.route({
    method: 'POST',
    url: '/discussion-comments/:id/replies',
    schema: {
      params: idParamSchema,
      body: createDiscussionReplyBodySchema,
      response: {
        200: discussionCommentSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Creates a reply to an existing discussion comment.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        const parent = await db.findDiscussionCommentById(request.params.id);
        if (!parent) {
          void reply.code(404).send({ error: 'Discussion comment not found' });
          return;
        }

        const target: DiscussionTargetContext = {
          targetEntityType: parent.targetEntityType,
          targetEntityId: parent.targetEntityId,
          collectionId: null
        };

        if (parent.targetEntityType === 'request') {
          const requestRecord = await db.findRequestById(parent.targetEntityId);
          target.collectionId = requestRecord?.collectionId ?? null;
        } else if (parent.targetEntityType === 'folder') {
          const folder = await db.findFolderById(parent.targetEntityId);
          target.collectionId = folder?.collectionId ?? null;
        } else if (parent.targetEntityType === 'collection') {
          target.collectionId = parent.targetEntityId;
        }

        if (denyUnlessAllowed(reply, canAccessDiscussionTarget(user, target))) {
          return;
        }

        const parsed = await parseDiscussionWriteBody(
          reply,
          getCollaboration(),
          db,
          user,
          request.body
        );
        if (!parsed) {
          return;
        }

        const record = await db.createDiscussionComment(
          {
            targetEntityType: parent.targetEntityType,
            targetEntityId: parent.targetEntityId,
            body: parsed.body,
            bodyFormat: parsed.bodyFormat,
            bodyMetadata: parsed.bodyMetadata,
            parentCommentId: parent.id
          },
          user.id
        );

        await createNoticeService(db).createNoticesForDiscussionComment(record, parent, user);

        const [serialized] = await serializeDiscussionComments(db, [record], getCollaboration());
        return reply.send(serialized);
      } catch (error) {
        if (error instanceof DiscussionCommentForbiddenError) {
          void reply.code(403).send({ error: error.message });
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
    method: 'PUT',
    url: '/discussion-comments/:id',
    schema: {
      params: idParamSchema,
      body: updateDiscussionCommentBodySchema,
      response: {
        200: discussionCommentSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Updates the body of a discussion comment authored by the current user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        const existing = await db.findDiscussionCommentById(request.params.id);
        if (!existing) {
          void reply.code(404).send({ error: 'Discussion comment not found' });
          return;
        }

        const target = await resolveDiscussionTargetFromComment(db, existing);
        if (!target || denyUnlessAllowed(reply, canAccessDiscussionTarget(user, target))) {
          if (!target) {
            void reply.code(404).send({ error: 'Discussion comment not found' });
          }
          return;
        }

        const parsed = await parseDiscussionWriteBody(
          reply,
          getCollaboration(),
          db,
          user,
          request.body
        );
        if (!parsed) {
          return;
        }

        const record = await db.updateDiscussionComment(request.params.id, parsed, user.id);
        const [serialized] = await serializeDiscussionComments(db, [record], getCollaboration());
        return reply.send(serialized);
      } catch (error) {
        if (error instanceof DiscussionCommentForbiddenError) {
          void reply.code(403).send({ error: error.message });
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
    method: 'DELETE',
    url: '/discussion-comments/:id',
    schema: {
      params: idParamSchema,
      response: {
        200: discussionCommentSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Tombstones a discussion comment while preserving child replies.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        const existing = await db.findDiscussionCommentById(request.params.id);
        if (!existing) {
          void reply.code(404).send({ error: 'Discussion comment not found' });
          return;
        }

        const target = await resolveDiscussionTargetFromComment(db, existing);
        if (!target) {
          void reply.code(404).send({ error: 'Discussion comment not found' });
          return;
        }

        if (
          denyUnlessAllowed(reply, canDeleteDiscussionComment(user, existing.authorUserId, target))
        ) {
          return;
        }

        const record = await db.tombstoneDiscussionComment(request.params.id, user.id);
        const [serialized] = await serializeDiscussionComments(db, [record], getCollaboration());
        return reply.send(serialized);
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}

/**
 * Route registration options for entity-scoped discussion list/create endpoints.
 */
interface EntityDiscussionRouteOptions {
  /**
   * HTTP method marker used only for documentation grouping.
   */
  method: 'GET';

  /**
   * List route URL pattern.
   */
  listUrl: string;

  /**
   * Create route URL pattern.
   */
  createUrl: string;

  /**
   * Resolver that loads target metadata for access checks.
   */
  resolveTarget: (entityId: string) => Promise<DiscussionTargetContext | null>;
}

/**
 * Registers list and create routes for one discussion target entity type.
 *
 * @param routes - Typed Fastify route registrar.
 * @param db - Database handle scoped to the active tenant.
 * @param options - Entity-specific route configuration.
 */
function registerEntityDiscussionRoutes(
  routes: ReturnType<FastifyInstance['withTypeProvider']>,
  db: IDatabase,
  getCollaboration: () => CollaborationConfig,
  options: EntityDiscussionRouteOptions
): void {
  void options.method;

  routes.route({
    method: 'GET',
    url: options.listUrl,
    schema: {
      params: idParamSchema,
      querystring: listDiscussionCommentsQuerySchema,
      response: {
        200: listDiscussionCommentsResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists discussion comments for a target entity.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        const params = request.params as { id: string };
        const query = request.query as { cursor?: string; limit?: number };
        const target = await options.resolveTarget(params.id);
        if (!target) {
          void reply.code(404).send({ error: 'Target entity not found' });
          return;
        }

        if (denyUnlessAllowed(reply, canAccessDiscussionTarget(user, target))) {
          return;
        }

        const result = await db.listDiscussionComments({
          targetEntityType: target.targetEntityType,
          targetEntityId: target.targetEntityId,
          cursor: query.cursor,
          limit: query.limit
        });

        return reply.send({
          comments: await serializeDiscussionComments(db, result.comments, getCollaboration()),
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
    url: options.createUrl,
    schema: {
      params: idParamSchema,
      body: createDiscussionCommentBodySchema,
      response: {
        200: discussionCommentSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Creates a top-level discussion comment on a target entity.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        const params = request.params as { id: string };
        const target = await options.resolveTarget(params.id);
        if (!target) {
          void reply.code(404).send({ error: 'Target entity not found' });
          return;
        }

        if (denyUnlessAllowed(reply, canAccessDiscussionTarget(user, target))) {
          return;
        }

        const parsed = await parseDiscussionWriteBody(
          reply,
          getCollaboration(),
          db,
          user,
          request.body
        );
        if (!parsed) {
          return;
        }

        const record = await db.createDiscussionComment(
          {
            targetEntityType: target.targetEntityType,
            targetEntityId: target.targetEntityId,
            body: parsed.body,
            bodyFormat: parsed.bodyFormat,
            bodyMetadata: parsed.bodyMetadata
          },
          user.id
        );

        await createNoticeService(db).createNoticesForDiscussionComment(record, null, user);

        const [serialized] = await serializeDiscussionComments(db, [record], getCollaboration());
        return reply.send(serialized);
      } catch (error) {
        if (error instanceof DiscussionCommentForbiddenError) {
          void reply.code(403).send({ error: error.message });
          return;
        }

        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}

/**
 * Reconstructs discussion target metadata from a stored comment record.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param comment - Stored discussion comment.
 * @returns Target context or null when the backing entity no longer exists.
 */
async function resolveDiscussionTargetFromComment(
  db: IDatabase,
  comment: DiscussionCommentRecord
): Promise<DiscussionTargetContext | null> {
  switch (comment.targetEntityType) {
    case 'request':
      return resolveRequestDiscussionTarget(db, comment.targetEntityId);
    case 'collection':
      return resolveCollectionDiscussionTarget(db, comment.targetEntityId);
    case 'folder':
      return resolveFolderDiscussionTarget(db, comment.targetEntityId);
    case 'runResult':
      return resolveRunResultDiscussionTarget(db, comment.targetEntityId);
    default:
      return null;
  }
}
