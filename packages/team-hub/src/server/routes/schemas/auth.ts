import { z } from 'zod/v4';
import { AVATAR_COLOR_KEYS } from '#/avatar/avatarPresentation.js';

/**
 * Account role values exposed on the session endpoint.
 */
export const userRoleSchema = z.enum(['admin', 'user']);

/**
 * Capability flags returned by `GET /auth/session`.
 */
export const sessionCapabilitiesSchema = z.object({
  dataApi: z.boolean(),
  managementApi: z.boolean(),
  llm: z.boolean(),
  communication: z.boolean(),
  discussionE2ee: z.boolean()
});

/**
 * Hub avatar metadata returned by session and admin routes.
 */
export const hubAvatarSchema = z.object({
  name: z.string(),
  initials: z.string(),
  color: z.enum(AVATAR_COLOR_KEYS)
});

/**
 * Response body schema for `GET /auth/session`.
 */
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    role: userRoleSchema,
    avatarInitials: z.string(),
    avatarColor: z.enum(AVATAR_COLOR_KEYS)
  }),
  token: z.object({
    id: z.string(),
    prefix: z.string()
  }),
  capabilities: sessionCapabilitiesSchema,
  tenantId: z.string(),
  hub: hubAvatarSchema
});

/**
 * Request body schema for `PUT /auth/profile/avatar`.
 */
export const updateMyAvatarBodySchema = z
  .object({
    initials: z.string().trim().min(1).max(2).optional(),
    color: z.enum(AVATAR_COLOR_KEYS).optional()
  })
  .superRefine((body, ctx) => {
    if (body.initials === undefined && body.color === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of initials or color is required.'
      });
    }
  });

/**
 * Response body schema for `PUT /auth/profile/avatar`.
 */
export const updateMyAvatarResponseSchema = z.object({
  avatarInitials: z.string(),
  avatarColor: z.enum(AVATAR_COLOR_KEYS)
});
