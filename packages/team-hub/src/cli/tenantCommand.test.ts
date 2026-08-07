import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  tenantListCommand,
  tenantCreateCommand,
  tenantDeleteCommand,
  type TenantCommandOptions,
  type TenantCreateCommandOptions,
  type TenantDeleteCommandOptions
} from '#/cli/tenantCommand.js';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { DEFAULT_TENANT_ID } from '#/config/multitenancyConfig.js';
import type { TenantRecord } from '#/db/types.js';
import { createProgram } from '#/cli/program.js';

const loadServerConfigMock = vi.fn();
const createDatabaseMock = vi.fn();

vi.mock('#/config/serverConfig.js', () => ({
  loadServerConfig: (configPath: string) => loadServerConfigMock(configPath),
  DEFAULT_CONFIG_PATH: 'server.yaml'
}));

vi.mock('#/db/index.js', () => ({
  createDatabase: (dbConfig: unknown) => createDatabaseMock(dbConfig)
}));

/**
 * Builds a stub database that returns itself from forTenant.
 */
function createTenantTestDatabase(): ReturnType<typeof createStubDatabase> {
  const db = createStubDatabase();
  db.forTenant.mockImplementation(() => db);
  db.getSystemUserId.mockReturnValue('system-user-id');
  db.ensureSystemUser.mockResolvedValue(undefined);
  return db;
}

describe('tenantCommand', () => {
  let mockStdout: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    mockStdout = [];
    originalLog = console.log;
    console.log = vi.fn((...args) => mockStdout.push(args.join(' ')));
    loadServerConfigMock.mockReset();
    loadServerConfigMock.mockReturnValue({
      db: { driver: 'postgres' },
      multitenancy: { enabled: true },
      llm: null
    });
    createDatabaseMock.mockReset();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('tenantListCommand', () => {
    it('lists all tenants', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      const tenants: TenantRecord[] = [
        {
          id: DEFAULT_TENANT_ID,
          name: 'Default Tenant',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdByUserId: null,
          updatedByUserId: null,
          avatarInitials: null,
          avatarColor: null
        },
        {
          id: 'org-acme',
          name: 'Acme Inc',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
          updatedAt: new Date('2026-01-15T10:00:00.000Z'),
          createdByUserId: 'system-user-id',
          updatedByUserId: 'system-user-id',
          avatarInitials: null,
          avatarColor: null
        }
      ];
      db.listTenants.mockResolvedValue(tenants);

      const options: TenantCommandOptions = { config: 'server.yaml' };
      await tenantListCommand(options);

      expect(db.connect).toHaveBeenCalled();
      expect(db.migrate).toHaveBeenCalled();
      expect(db.listTenants).toHaveBeenCalled();
      expect(db.disconnect).toHaveBeenCalled();
      expect(mockStdout.join('\n')).toContain('__default__');
      expect(mockStdout.join('\n')).toContain('org-acme');
    });

    it('displays message when no tenants exist', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      db.listTenants.mockResolvedValue([]);

      const options: TenantCommandOptions = { config: 'server.yaml' };
      await tenantListCommand(options);

      expect(mockStdout.join('\n')).toContain('No tenants found.');
    });
  });

  describe('tenantCreateCommand', () => {
    it('creates a new tenant', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      const newTenant: TenantRecord = {
        id: 'org-acme',
        name: 'Acme Inc',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        updatedAt: new Date('2026-01-15T10:00:00.000Z'),
        createdByUserId: 'system-user-id',
        updatedByUserId: 'system-user-id',
        avatarInitials: null,
        avatarColor: null
      };

      db.findTenantById.mockResolvedValue(null);
      db.createTenant.mockResolvedValue(newTenant);

      const options: TenantCreateCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme',
        name: 'Acme Inc'
      };

      await tenantCreateCommand(options);

      expect(db.connect).toHaveBeenCalled();
      expect(db.migrate).toHaveBeenCalled();
      expect(db.findTenantById).toHaveBeenCalledWith('org-acme');
      expect(db.createTenant).toHaveBeenCalledWith('org-acme', 'Acme Inc', 'system-user-id');
      expect(db.forTenant).toHaveBeenCalledWith(DEFAULT_TENANT_ID);
      expect(db.forTenant).toHaveBeenCalledWith('org-acme');
      expect(db.ensureSystemUser).toHaveBeenCalled();
      expect(db.disconnect).toHaveBeenCalled();
      expect(mockStdout.join('\n')).toContain('Created tenant "Acme Inc" (org-acme).');
    });

    it('rejects when multitenancy is disabled', async () => {
      loadServerConfigMock.mockReturnValueOnce({
        db: { driver: 'postgres' },
        multitenancy: { enabled: false },
        llm: null
      });

      const options: TenantCreateCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme',
        name: 'Acme Inc'
      };

      await expect(tenantCreateCommand(options)).rejects.toThrow(
        'Multitenancy is disabled in server.yaml'
      );
    });

    it('rejects when tenant already exists', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      const existingTenant: TenantRecord = {
        id: 'org-acme',
        name: 'Acme Inc',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        updatedAt: new Date('2026-01-15T10:00:00.000Z'),
        createdByUserId: 'system-user-id',
        updatedByUserId: 'system-user-id',
        avatarInitials: null,
        avatarColor: null
      };

      db.findTenantById.mockResolvedValue(existingTenant);

      const options: TenantCreateCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme',
        name: 'Acme Inc'
      };

      await expect(tenantCreateCommand(options)).rejects.toThrow(
        'A tenant with id "org-acme" already exists.'
      );
    });
  });

  describe('tenantDeleteCommand', () => {
    it('deletes an existing tenant', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      const existingTenant: TenantRecord = {
        id: 'org-acme',
        name: 'Acme Inc',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        updatedAt: new Date('2026-01-15T10:00:00.000Z'),
        createdByUserId: 'system-user-id',
        updatedByUserId: 'system-user-id',
        avatarInitials: null,
        avatarColor: null
      };

      db.findTenantById.mockResolvedValue(existingTenant);

      const options: TenantDeleteCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme'
      };

      await tenantDeleteCommand(options);

      expect(db.connect).toHaveBeenCalled();
      expect(db.migrate).toHaveBeenCalled();
      expect(db.findTenantById).toHaveBeenCalledWith('org-acme');
      expect(db.deleteTenant).toHaveBeenCalledWith('org-acme', 'system-user-id');
      expect(db.disconnect).toHaveBeenCalled();
      expect(mockStdout.join('\n')).toContain('Deleted tenant "Acme Inc" (org-acme).');
    });

    it('rejects when multitenancy is disabled', async () => {
      loadServerConfigMock.mockReturnValueOnce({
        db: { driver: 'postgres' },
        multitenancy: { enabled: false },
        llm: null
      });

      const options: TenantDeleteCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme'
      };

      await expect(tenantDeleteCommand(options)).rejects.toThrow(
        'Multitenancy is disabled in server.yaml'
      );
    });

    it('displays message when tenant not found', async () => {
      const db = createTenantTestDatabase();
      createDatabaseMock.mockReturnValue(db);
      db.findTenantById.mockResolvedValue(null);

      const options: TenantDeleteCommandOptions = {
        config: 'server.yaml',
        id: 'org-acme'
      };

      await tenantDeleteCommand(options);

      expect(mockStdout.join('\n')).toContain('No tenant found with id "org-acme".');
    });
  });

  describe('registerTenantCommand', () => {
    it('registers tenant subcommands', () => {
      const program = createProgram('1.0.0');
      const tenant = program.commands.find((cmd) => cmd.name() === 'tenant');

      expect(tenant).toBeDefined();
      expect(tenant?.description()).toBe('Manage tenant namespaces');

      const list = tenant?.commands.find((cmd) => cmd.name() === 'list');
      const create = tenant?.commands.find((cmd) => cmd.name() === 'create');
      const deleteCmd = tenant?.commands.find((cmd) => cmd.name() === 'delete');

      expect(list).toBeDefined();
      expect(create).toBeDefined();
      expect(deleteCmd).toBeDefined();
    });
  });
});
