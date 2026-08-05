import { Command, InvalidArgumentError } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { createDatabase } from '#/db/index.js';
import type { CollectionRecord } from '#/db/types.js';
import {
  DEFAULT_TENANT_ID,
  isDefaultTenantId,
  normalizeTenantId
} from '#/config/multitenancyConfig.js';

export interface CollectionCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;

  /**
   * Optional tenant identifier (defaults to {@link DEFAULT_TENANT_ID}).
   */
  tenant?: string;
}

/**
 * Parses and validates an optional tenant id from CLI input.
 *
 * @param value - Tenant id string from a Commander option.
 * @returns Trimmed and validated tenant id.
 * @throws {InvalidArgumentError} When the id is invalid.
 */
function parseOptionalTenantId(value: string): string {
  try {
    return normalizeTenantId(value);
  } catch (error) {
    if (error instanceof Error) {
      throw new InvalidArgumentError(error.message);
    }

    throw error;
  }
}

/**
 * Resolves the effective tenant id from CLI options and validates multitenancy config.
 *
 * @param options - Parsed command options including optional tenant flag.
 * @param multitenancyEnabled - Whether multitenancy is enabled in server.yaml.
 * @returns Effective tenant id (default or parsed).
 * @throws {Error} When a non-default tenant is used but multitenancy is disabled.
 */
function resolveTenantId(options: { tenant?: string }, multitenancyEnabled: boolean): string {
  const tenantId = options.tenant ?? DEFAULT_TENANT_ID;
  if (!multitenancyEnabled && !isDefaultTenantId(tenantId)) {
    throw new Error(
      'Multitenancy is disabled in server.yaml. Set multitenancy.enabled to true to use non-default tenants.'
    );
  }

  return tenantId;
}

/**
 * Formats a stored user id for CLI attribution output.
 *
 * @param userId - User id from a record's attribution field, or null when unset.
 * @param usersById - Lookup map from user id to display name.
 * @returns Display name with id, raw id, or a dash placeholder.
 */
function formatAttributionUser(userId: string | null, usersById: Map<string, string>): string {
  if (!userId) {
    return '-';
  }

  const name = usersById.get(userId);
  if (!name) {
    return userId;
  }

  return `${name} (${userId})`;
}

/**
 * Prints a collection record for CLI listings.
 *
 * @param collection - Collection record to display.
 * @param usersById - Lookup map from user id to display name.
 * @param requestCount - Number of saved requests in the collection.
 */
function printCollection(
  collection: CollectionRecord,
  usersById: Map<string, string>,
  requestCount: number
): void {
  console.log(`- id: ${collection.id}`);
  console.log(`  name: ${collection.name}`);
  console.log(`  requests: ${requestCount}`);
  console.log(`  created: ${collection.createdAt.toISOString()}`);
  console.log(`  updated: ${collection.updatedAt.toISOString()}`);
  console.log(`  created by: ${formatAttributionUser(collection.createdByUserId, usersById)}`);
  console.log(`  updated by: ${formatAttributionUser(collection.updatedByUserId, usersById)}`);
}

/**
 * Lists stored collections.
 *
 * @param options - Parsed collection list options including config path.
 */
export async function collectionListCommand(options: CollectionCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const tenantId = resolveTenantId(options, config.multitenancy?.enabled ?? false);
  const rootDb = createDatabase(config.db);

  await rootDb.connect();
  await rootDb.migrate();
  const db = rootDb.forTenant(tenantId);
  const collections = await db.listCollections();
  const users = await db.listUsers();
  const requestCounts = await Promise.all(
    collections.map(async (collection) => {
      const requests = await db.listRequests(collection.id);
      return [collection.id, requests.length] as const;
    })
  );
  await rootDb.disconnect();

  const usersById = new Map(users.map((user) => [user.id, user.name]));
  const requestCountByCollectionId = new Map(requestCounts);

  if (collections.length === 0) {
    console.log('No collections found.');
    return;
  }

  for (const collection of collections) {
    printCollection(collection, usersById, requestCountByCollectionId.get(collection.id) ?? 0);
  }
}

/**
 * Registers the `collection` command group on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handlers - Injectable handlers for testing.
 */
export function registerCollectionCommand(
  program: Command,
  handlers: {
    list?: (options: CollectionCommandOptions) => Promise<void>;
  } = {}
): void {
  const collection = program.command('collection').description('Inspect stored collections');

  collection
    .command('list')
    .description('List stored collections')
    .option('--tenant <id>', 'Tenant namespace (default: __default__)', parseOptionalTenantId)
    .action(
      /**
       * Runs the collection list subcommand after merging global CLI options.
       */
      async function collectionListAction(this: Command, options: CollectionCommandOptions) {
        await (handlers.list ?? collectionListCommand)(mergeGlobalOptions(this, options));
      }
    );
}
