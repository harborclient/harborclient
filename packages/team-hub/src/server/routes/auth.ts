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
     * Updates avatar presentation for the authenticated user account.
     */
    handler: async (request, reply) => {
      const user = requireAuthenticatedUser(request);

      try {
        const avatar = await updateUserAvatar(
          options.db,
          user.id,
          {
            initials: request.body.initials,
            color: request.body.color
          },
          user.id
        );

        return reply.send({
          avatarInitials: avatar.initials,
          avatarColor: avatar.color
        });
      } catch (error) {
        if (handleValidationError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}
