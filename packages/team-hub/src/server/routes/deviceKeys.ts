import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CollaborationConfig } from '#/config/collaborationConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { buildDeviceKeyRecord } from '#/db/deviceKeyLogic.js';
import { canUseDataApi, canUseManagementApi } from '#/server/auth/accessControl.js';
import { handleDbError, handleValidationError } from '#/server/routes/errors.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { errorResponseSchema, idParamSchema } from '#/server/routes/schemas/common.js';
import { emptyResponseSchema } from '#/server/routes/schemas/entities.js';
import {
  enrollDeviceBodySchema,
  enrolledDeviceResponseSchema,
  listDeviceKeysResponseSchema,
  serializeDeviceKey
} from '#/server/routes/schemas/deviceKeys.js';

/**
 * Error message returned when device enrollment is unavailable on a plaintext hub.
 */
export const DEVICE_ENROLLMENT_DISABLED_MESSAGE =
  'Device enrollment is only available on Team Hubs with discussion E2EE enabled.';

/**
 * Sends a 404 response when collaboration E2EE is disabled on the hub.
 *
 * @param reply - Fastify reply used to short-circuit the handler.
 * @param collaboration - Active collaboration settings.
 * @returns True when the handler should return early.
 */
export function denyUnlessDiscussionE2eeEnabled(
  reply: FastifyReply,
  collaboration: CollaborationConfig
): boolean {
  if (collaboration.e2ee) {
    return false;
  }

  void reply
    .code(404)
    .send(errorResponseSchema.parse({ error: DEVICE_ENROLLMENT_DISABLED_MESSAGE }));
  return true;
}

/**
 * Registers bearer-protected device key enrollment and revocation routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param db - Database used to persist device key metadata.
 * @param getCollaboration - Returns active collaboration settings for E2EE gating.
 */
export async function registerDeviceKeyRoutes(
  app: FastifyInstance,
  db: IDatabase,
  getCollaboration: () => CollaborationConfig
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'POST',
    url: '/devices',
    schema: {
      body: enrollDeviceBodySchema,
      response: {
        201: enrolledDeviceResponseSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema
      }
    },
    /**
     * Enrolls the authenticated user's current device with public key material.
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

        const existing = await db.findActiveDeviceKeyByUserAndDeviceId(
          user.id,
          request.body.deviceId
        );
        if (existing) {
          void reply
            .code(409)
            .send(errorResponseSchema.parse({ error: 'This device is already enrolled.' }));
          return;
        }

        const record = buildDeviceKeyRecord(
          {
            userId: user.id,
            deviceId: request.body.deviceId,
            label: request.body.label,
            publicKeyMaterial: request.body.publicKeyMaterial,
            keyFormat: request.body.keyFormat
          },
          user.id
        );

        await db.createDeviceKey(record, user.id);

        return reply.code(201).send({
          device: serializeDeviceKey(record)
        });
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
    url: '/devices',
    schema: {
      response: {
        200: listDeviceKeysResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists device key enrollments for the authenticated user.
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

        const devices = await db.listDeviceKeysByUserId(user.id);
        return reply.send({
          devices: devices.map((record) => serializeDeviceKey(record))
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
    method: 'DELETE',
    url: '/devices/:id',
    schema: {
      params: idParamSchema,
      response: {
        204: emptyResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Revokes one of the authenticated user's enrolled devices.
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

        const existing = await db.findDeviceKeyById(request.params.id);
        if (!existing || existing.userId !== user.id) {
          void reply.code(404).send(errorResponseSchema.parse({ error: 'Device not found' }));
          return;
        }

        const revoked = await db.revokeDeviceKey(existing.id, user.id);
        if (!revoked) {
          void reply.code(404).send(errorResponseSchema.parse({ error: 'Device not found' }));
          return;
        }

        return reply.code(204).send(null);
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
    url: '/admin/device-keys',
    schema: {
      response: {
        200: listDeviceKeysResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists all device key enrollments for operator administration.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseManagementApi(user))) {
          return;
        }

        const devices = await db.listDeviceKeys();
        return reply.send({
          devices: devices.map((record) => serializeDeviceKey(record))
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
    url: '/admin/users/:id/devices',
    schema: {
      params: idParamSchema,
      response: {
        200: listDeviceKeysResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Lists device key enrollments owned by a specific user account.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseManagementApi(user))) {
          return;
        }

        const target = await db.findUserById(request.params.id);
        if (!target) {
          void reply.code(404).send(errorResponseSchema.parse({ error: 'User not found' }));
          return;
        }

        const devices = await db.listDeviceKeysByUserId(target.id);
        return reply.send({
          devices: devices.map((record) => serializeDeviceKey(record))
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
    method: 'DELETE',
    url: '/admin/device-keys/:id',
    schema: {
      params: idParamSchema,
      response: {
        204: emptyResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema
      }
    },
    /**
     * Revokes a compromised or lost device key enrollment.
     */
    handler: async (request, reply) => {
      try {
        if (denyUnlessDiscussionE2eeEnabled(reply, getCollaboration())) {
          return;
        }

        const user = requireAuthenticatedUser(request);
        if (denyUnlessAllowed(reply, canUseManagementApi(user))) {
          return;
        }

        const existing = await db.findDeviceKeyById(request.params.id);
        if (!existing) {
          void reply.code(404).send(errorResponseSchema.parse({ error: 'Device not found' }));
          return;
        }

        const revoked = await db.revokeDeviceKey(existing.id, user.id);
        if (!revoked) {
          void reply.code(404).send(errorResponseSchema.parse({ error: 'Device not found' }));
          return;
        }

        return reply.code(204).send(null);
      } catch (error) {
        if (handleDbError(reply, error)) {
          return;
        }

        throw error;
      }
    }
  });
}
