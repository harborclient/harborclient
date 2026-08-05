import { Command, InvalidArgumentError } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { createDatabase } from '#/db/index.js';
import {
  DEFAULT_TENANT_ID,
  isDefaultTenantId,
  normalizeTenantId
} from '#/config/multitenancyConfig.js';
import type { TenantRecord } from '#/db/types.js';

export interface TenantCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;
}

export interface TenantCreateCommandOptions extends TenantCommandOptions {
  /**
   * Unique stable identifier for the new tenant.
   */
  id: string;

  /**
   * Human-readable display name for the tenant.
   */
  name: string;
}

export interface TenantDeleteCommandOptions extends TenantCommandOptions {
  /**
   * Identifier of the tenant to delete.
   */
  id: string;
}

/**
 * Parses and validates a tenant id from CLI input.
 *
 * @param value - Tenant id string from a Commander argument.
 * @returns Trimmed and validated tenant id.
 * @throws {InvalidArgumentError} When the id is invalid or is the reserved default.
 */
function parseTenantId(value: string): string {
  try {
    const id = normalizeTenantId(value);
    if (isDefaultTenantId(id)) {
      throw new InvalidArgumentError(
        `Cannot create or delete the reserved default tenant id "${DEFAULT_TENANT_ID}".`
      );
    }

    return id;
  } catch (error) {
    if (error instanceof Error) {
      throw new InvalidArgumentError(error.message);
    }

    throw error;
  }
}

/**
 * Parses and validates a tenant name from CLI input.
 *
 * @param value - Tenant name string from a Commander option.
 * @returns Trimmed non-empty name.
 * @throws {InvalidArgumentError} When the name is empty after trimming.
 */
function parseTenantName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new InvalidArgumentError('Tenant name must not be empty.');
  }

  return name;
}

/**
 * Prints a tenant record for CLI listings.
 *
 * @param tenant - Tenant record to display.
 */
function printTenant(tenant: TenantRecord): void {
  console.log(`- id: ${tenant.id}`);
  console.log(`  name: ${tenant.name}`);
  console.log(`  created: ${tenant.createdAt.toISOString()}`);
  console.log(`  updated: ${tenant.updatedAt.toISOString()}`);
}

/**
 * Lists all tenant records.
 *
 * @param options - Parsed tenant list options including config path.
 */
export async function tenantListCommand(options: TenantCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);

  await db.connect();
  await db.migrate();
  const tenants = await db.listTenants();
  await db.disconnect();

  if (tenants.length === 0) {
    console.log('No tenants found.');
    return;
  }

  for (const tenant of tenants) {
    printTenant(tenant);
  }
}

/**
 * Creates a new non-default tenant.
 *
 * @param options - Parsed tenant create options including id and name.
 */
export async function tenantCreateCommand(options: TenantCreateCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);

  if (!(config.multitenancy?.enabled ?? false)) {
    throw new Error(
      'Multitenancy is disabled in server.yaml. Set multitenancy.enabled to true to create non-default tenants.'
    );
  }

  const db = createDatabase(config.db);

  await db.connect();
  await db.migrate();

  const existing = await db.findTenantById(options.id);
  if (existing) {
    await db.disconnect();
    throw new Error(`A tenant with id "${options.id}" already exists.`);
  }

  const defaultTenantDb = db.forTenant(DEFAULT_TENANT_ID);
  await defaultTenantDb.ensureSystemUser();
  const systemUserId = defaultTenantDb.getSystemUserId();
  if (!systemUserId) {
    await db.disconnect();
    throw new Error('System user is not provisioned in the default tenant.');
  }

  const tenant = await db.createTenant(options.id, options.name, systemUserId);
  const newTenantDb = db.forTenant(tenant.id);
  await newTenantDb.ensureSystemUser();
  await db.disconnect();

  console.log(`Created tenant "${tenant.name}" (${tenant.id}).`);
  printTenant(tenant);
}

/**
 * Deletes a non-default tenant and all of its data.
 *
 * @param options - Parsed tenant delete options including tenant id.
 */
export async function tenantDeleteCommand(options: TenantDeleteCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);

  if (!(config.multitenancy?.enabled ?? false)) {
    throw new Error(
      'Multitenancy is disabled in server.yaml. Set multitenancy.enabled to true to delete non-default tenants.'
    );
  }

  const db = createDatabase(config.db);

  await db.connect();
  await db.migrate();

  const existing = await db.findTenantById(options.id);
  if (!existing) {
    await db.disconnect();
    console.log(`No tenant found with id "${options.id}".`);
    return;
  }

  const defaultTenantDb = db.forTenant(DEFAULT_TENANT_ID);
  await defaultTenantDb.ensureSystemUser();
  const systemUserId = defaultTenantDb.getSystemUserId();
  if (!systemUserId) {
    await db.disconnect();
    throw new Error('System user is not provisioned in the default tenant.');
  }

  await db.deleteTenant(options.id, systemUserId);
  await db.disconnect();

  console.log(`Deleted tenant "${existing.name}" (${existing.id}).`);
}

/**
 * Registers the `tenant` command group on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handlers - Injectable handlers for testing.
 */
export function registerTenantCommand(
  program: Command,
  handlers: {
    list?: (options: TenantCommandOptions) => Promise<void>;
    create?: (options: TenantCreateCommandOptions) => Promise<void>;
    delete?: (options: TenantDeleteCommandOptions) => Promise<void>;
  } = {}
): void {
  const tenant = program.command('tenant').description('Manage tenant namespaces');

  tenant
    .command('list')
    .description('List all tenant records')
    .action(
      /**
       * Runs the tenant list subcommand after merging global CLI options.
       */
      async function tenantListAction(this: Command, options: TenantCommandOptions) {
        await (handlers.list ?? tenantListCommand)(mergeGlobalOptions(this, options));
      }
    );

  tenant
    .command('create')
    .description('Create a new non-default tenant')
    .argument(
      '<id>',
      'Unique tenant identifier (letters, digits, underscores, hyphens)',
      parseTenantId
    )
    .requiredOption('--name <name>', 'Human-readable tenant label', parseTenantName)
    .action(
      /**
       * Runs the tenant create subcommand after merging global CLI options.
       */
      async function tenantCreateAction(
        this: Command,
        id: string,
        options: TenantCommandOptions & { name: string }
      ) {
        await (handlers.create ?? tenantCreateCommand)(
          mergeGlobalOptions(this, { ...options, id })
        );
      }
    );

  tenant
    .command('delete')
    .description('Delete a non-default tenant and all of its data')
    .argument('<id>', 'Tenant identifier to delete', parseTenantId)
    .action(
      /**
       * Runs the tenant delete subcommand after merging global CLI options.
       */
      async function tenantDeleteAction(this: Command, id: string, options: TenantCommandOptions) {
        await (handlers.delete ?? tenantDeleteCommand)(
          mergeGlobalOptions(this, { ...options, id })
        );
      }
    );
}
