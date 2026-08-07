import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTITENANCY_CONFIG } from '#/config/multitenancyConfig.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { createTenantResolutionHook, readTenantHeader } from '#/server/auth/tenantContext.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Builds a minimal Fastify reply stub that records status and body.
 */
function createReplyStub(): FastifyReply & {
  statusCode: number;
  body: unknown;
} {
  const reply = {
    statusCode: 200,
    body: undefined as unknown,
    /**
     * Records the HTTP status code.
     *
     * @param status - Status to store.
     */
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    /**
     * Records the response body.
     *
     * @param body - Body to store.
     */
    send(body: unknown) {
      reply.body = body;
      return reply;
    }
  };
  return reply as unknown as FastifyReply & { statusCode: number; body: unknown };
}

/**
 * Builds a minimal request stub with headers.
 *
 * @param headers - Request headers.
 */
function createRequestStub(headers: Record<string, string> = {}): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe('readTenantHeader', () => {
  it('reads a string header value', () => {
    expect(readTenantHeader(createRequestStub({ 'x-harbor-tenant': 'acme' }))).toBe('acme');
  });
});

describe('createTenantResolutionHook', () => {
  it('resolves the default tenant when the header is missing', async () => {
    const db = createStubDatabase();
    const scoped = createStubDatabase();
    db.forTenant.mockReturnValue(scoped);
    const hook = createTenantResolutionHook(db, () => DEFAULT_MULTITENANCY_CONFIG);
    const request = createRequestStub();
    const reply = createReplyStub();

    await hook(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(request.tenantId).toBe('__default__');
    expect(request.db).toBe(scoped);
    expect(db.forTenant).toHaveBeenCalledWith('__default__');
  });

  it('rejects non-default tenants when multitenancy is disabled', async () => {
    const db = createStubDatabase();
    const hook = createTenantResolutionHook(db, () => DEFAULT_MULTITENANCY_CONFIG);
    const request = createRequestStub({ 'x-harbor-tenant': 'acme' });
    const reply = createReplyStub();

    await hook(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.body).toEqual({
      error: 'Multitenancy is disabled; only the default tenant is available.'
    });
  });

  it('returns 404 when an enabled non-default tenant is missing', async () => {
    const db = createStubDatabase();
    db.findTenantById.mockResolvedValue(null);
    const hook = createTenantResolutionHook(db, () => ({ enabled: true }));
    const request = createRequestStub({ 'x-harbor-tenant': 'acme' });
    const reply = createReplyStub();

    await hook(request, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.body).toEqual({ error: 'Tenant not found' });
  });

  it('scopes the database when an enabled tenant exists', async () => {
    const db = createStubDatabase();
    const scoped = createStubDatabase();
    db.findTenantById.mockResolvedValue({
      id: 'acme',
      name: 'Acme',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: null,
      updatedByUserId: null,
      avatarInitials: null,
      avatarColor: null
    });
    db.forTenant.mockReturnValue(scoped);
    const hook = createTenantResolutionHook(db, () => ({ enabled: true }));
    const request = createRequestStub({ 'x-harbor-tenant': 'acme' });
    const reply = createReplyStub();

    await hook(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(request.tenantId).toBe('acme');
    expect(request.db).toBe(scoped);
  });
});
