import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { IDatabase } from '#/db/IDatabase.js';
import type { NoticeRecord, UserRecord } from '#/db/types.js';
import { filterAccessibleNotices } from '#/db/noticeLogic.js';
import { canUseDataApi } from '#/server/auth/accessControl.js';
import { handleDbError } from '#/server/routes/errors.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { errorResponseSchema, idParamSchema } from '#/server/routes/schemas/common.js';
import {
  listNoticesQuerySchema,
  listNoticesResponseSchema,
  notificationSettingsResponseSchema,
  noticeSchema,
  serializeNotice,
  serializeNotificationSettings,
  threadSubscriptionResponseSchema,
  unreadNoticeCountResponseSchema,
  updateNotificationSettingsBodySchema
} from '#/server/routes/schemas/notices.js';

/**
 * Loads actor user records referenced by a notice page.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param notices - Notice records whose actors should be resolved.
 * @returns Map of actor user id to user records.
 */
async function resolveNoticeActors(
  db: IDatabase,
  notices: NoticeRecord[]
): Promise<Map<string, UserRecord>> {
  const actorIds = [
    ...new Set(notices.map((notice) => notice.actorUserId).filter(Boolean) as string[])
  ];
  const actors = new Map<string, UserRecord>();

  await Promise.all(
    actorIds.map(async (userId) => {
      const user = await db.findUserById(userId);
      if (user) {
        actors.set(userId, user);
      }
    })
  );

  return actors;
}

/**
 * Registers bearer-protected notice, notification settings, and subscription routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist notices and settings.
 */
export async function registerNoticeRoutes(app: FastifyInstance, db: IDatabase): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'GET',
    url: '/notices',
    schema: {
      querystring: listNoticesQuerySchema,
      response: {
        200: listNoticesResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Lists collaboration notices for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const result = await db.listNotices({
          recipientUserId: user.id,
          cursor: request.query.cursor,
          limit: request.query.limit
        });

        const accessible = filterAccessibleNotices(user, result.notices);
        const actors = await resolveNoticeActors(db, accessible);

        return reply.send({
          notices: accessible.map((notice) =>
            serializeNotice(
              notice,
              notice.actorUserId ? (actors.get(notice.actorUserId) ?? null) : null
            )
          ),
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
    method: 'GET',
    url: '/notices/unread-count',
    schema: {
      response: {
        200: unreadNoticeCountResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Returns the unread notice count for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const unreadCount = await db.countUnreadNotices(user.id);
        return reply.send({ count: unreadCount });
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
    url: '/notices/:id/read',
    schema: {
      params: idParamSchema,
      response: {
        200: noticeSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Marks one notice read for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const record = await db.markNoticeRead(request.params.id, user.id);
        if (!record) {
          void reply.code(404).send({ error: 'Notice not found' });
          return;
        }

        if (!filterAccessibleNotices(user, [record]).length) {
          void reply.code(404).send({ error: 'Notice not found' });
          return;
        }

        const actor = record.actorUserId ? await db.findUserById(record.actorUserId) : null;
        return reply.send(serializeNotice(record, actor));
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
    url: '/notices/read-all',
    schema: {
      response: {
        200: unreadNoticeCountResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Marks all unread notices read for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        await db.markAllNoticesRead(user.id);
        return reply.send({ count: 0 });
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
    url: '/me/notification-settings',
    schema: {
      response: {
        200: notificationSettingsResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Returns notification settings for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const settings = await db.getUserNotificationSettings(user.id);
        return reply.send(serializeNotificationSettings(settings));
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'PUT',
    url: '/me/notification-settings',
    schema: {
      body: updateNotificationSettingsBodySchema,
      response: {
        200: notificationSettingsResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Updates notification settings for the authenticated user.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const settings = await db.updateUserNotificationSettings(user.id, request.body.level);
        return reply.send(serializeNotificationSettings(settings));
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
    url: '/discussion-threads/:id/subscription',
    schema: {
      params: idParamSchema,
      response: {
        200: threadSubscriptionResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Returns whether the authenticated user is subscribed to a discussion thread.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const subscribed = await db.isSubscribedToDiscussionThread(user.id, request.params.id);
        return reply.send({ subscribed, rootCommentId: request.params.id });
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
    url: '/discussion-threads/:id/subscribe',
    schema: {
      params: idParamSchema,
      response: {
        200: threadSubscriptionResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Subscribes the authenticated user to a discussion thread.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        const rootComment = await db.findDiscussionCommentById(request.params.id);
        if (!rootComment || rootComment.rootCommentId !== rootComment.id) {
          void reply.code(404).send({ error: 'Discussion thread not found' });
          return;
        }

        await db.subscribeDiscussionThread(user.id, rootComment.id);
        return reply.send({ subscribed: true, rootCommentId: rootComment.id });
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
    url: '/discussion-threads/:id/unsubscribe',
    schema: {
      params: idParamSchema,
      response: {
        200: threadSubscriptionResponseSchema,
        403: errorResponseSchema
      }
    },
    /**
     * Unsubscribes the authenticated user from a discussion thread.
     */
    handler: async (request, reply) => {
      try {
        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseDataApi(user))) {
          return;
        }

        await db.unsubscribeDiscussionThread(user.id, request.params.id);
        return reply.send({ subscribed: false, rootCommentId: request.params.id });
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}
