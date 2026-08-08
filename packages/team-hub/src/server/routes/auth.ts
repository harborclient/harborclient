import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import { updateUserAvatar } from '#/avatar/userAvatarService.js';
import { ensureHubAvatar } from '#/avatar/hubAvatarService.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { buildSessionPayload } from '#/server/auth/sessionCapabilities.js';
import { handleValidationError } from '#/server/routes/errors.js';
import { requireAuthenticatedUser } from '#/server/routes/authorize.js';
import {
  sessionResponseSchema,
  updateMyAvatarBodySchema,
  updateMyAvatarResponseSchema
} from '#/server/routes/schemas/auth.js';
import { errorResponseSchema } from '#/server/routes/schemas/common.js';
import { z } from 'zod/v4';

/**
 * Options for registering authentication introspection routes.
 */
export interface RegisterAuthRoutesOptions {
  /**
   * Tenant-scoped database used for user avatar updates.
   */
  db: IDatabase;

  /**
   * Root database used for global tenant avatar records.
   */
  rootDb: IDatabase;

  /**
   * Returns the active collaboration configuration for capability serialization.
   */
  getCollaboration: () => CollaborationConfig;
}

/**
 * Registers bearer-protected authentication introspection routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param options - Database access for user and hub avatar resolution.
 */
export async function registerAuthRoutes(
  app: FastifyInstance,
  options: RegisterAuthRoutesOptions
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'GET',
    url: '/auth/session',
    schema: {
      response: {
        200: sessionResponseSchema
      }
    },
    /**
     * Returns the authenticated user, token metadata, derived API capabilities, and hub avatar.
     */
    handler: async (request, reply) => {
      const user = requireAuthenticatedUser(request);
      const apiToken = request.apiToken;

      if (!apiToken) {
        throw new Error('Authenticated API token is required');
      }

      const hub = await ensureHubAvatar(options.rootDb, request.tenantId);
      return reply.send(
        buildSessionPayload(user, apiToken, request.tenantId, hub, options.getCollaboration())
      );
    }
  });

  routes.route({
    method: 'PUT',
    url: '/auth/profile/avatar',
    schema: {
      body: updateMyAvatarBodySchema,
      response: {
        200: updateMyAvatarResponseSchema,
        400: errorResponseSchema
      }
    },
    /**
     * Updates avatar presentation and/or uploaded image for the authenticated user.
     */
    handler: async (request, reply) => {
      const user = requireAuthenticatedUser(request);

      try {
        const avatar = await updateUserAvatar(
          options.db,
          user.id,
          {
            initials: request.body.initials,
            color: request.body.color,
            imageDataUrl: request.body.imageDataUrl
          },
          user.id
        );

        return reply.send({
          avatarInitials: avatar.initials,
          avatarColor: avatar.color,
          ...(avatar.imageUrl ? { avatarImageUrl: avatar.imageUrl } : {})
        });
      } catch (error) {
        if (handleValidationError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });

  routes.route({
    method: 'GET',
    url: '/auth/users/:id/avatar',
    schema: {
      params: z.object({
        id: z.string().min(1)
      }),
      response: {
        404: errorResponseSchema
      }
    },
    /**
     * Returns the uploaded avatar image bytes for a Team Hub user account.
     */
    handler: async (request, reply) => {
      requireAuthenticatedUser(request);

      const target = await options.db.findUserById(request.params.id);
      if (
        target == null ||
        target.avatarImage == null ||
        target.avatarImage.length === 0 ||
        target.avatarImageMime == null
      ) {
        return reply.code(404).send(errorResponseSchema.parse({ error: 'Avatar image not found' }));
      }

      const bytes = Buffer.from(target.avatarImage, 'base64');
      const etag =
        target.avatarImageUpdatedAt != null
          ? `"${target.avatarImageUpdatedAt.getTime()}"`
          : undefined;

      if (etag != null) {
        void reply.header('ETag', etag);
      }

      reply
        .header('Content-Type', target.avatarImageMime)
        .header('Cache-Control', 'private, max-age=3600')
        .header('Content-Length', String(bytes.byteLength));
      // Binary body is intentionally untyped; response schema only covers the 404 JSON error.
      return reply.send(bytes as unknown as { error: string });
    }
  });

  routes.route({
    method: 'GET',
    url: '/auth/hub/avatar',
    schema: {
      response: {
        404: errorResponseSchema
      }
    },
    /**
     * Returns the uploaded hub avatar image bytes for the active tenant namespace.
     */
    handler: async (request, reply) => {
      requireAuthenticatedUser(request);

      const tenant = await options.rootDb.findTenantById(request.tenantId);
      if (
        tenant == null ||
        tenant.avatarImage == null ||
        tenant.avatarImage.length === 0 ||
        tenant.avatarImageMime == null
      ) {
        return reply.code(404).send(errorResponseSchema.parse({ error: 'Avatar image not found' }));
      }

      const bytes = Buffer.from(tenant.avatarImage, 'base64');
      const etag =
        tenant.avatarImageUpdatedAt != null
          ? `"${tenant.avatarImageUpdatedAt.getTime()}"`
          : undefined;

      if (etag != null) {
        void reply.header('ETag', etag);
      }

      reply
        .header('Content-Type', tenant.avatarImageMime)
        .header('Cache-Control', 'private, max-age=3600')
        .header('Content-Length', String(bytes.byteLength));
      // Binary body is intentionally untyped; response schema only covers the 404 JSON error.
      return reply.send(bytes as unknown as { error: string });
    }
  });
}
