import { Command } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { isExternalBlobStorage } from '#/config/storageConfig.js';
import { createDatabase } from '#/db/index.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { buildHubAvatarObjectKey, buildUserAvatarObjectKey } from '#/storage/avatarObjectKeys.js';
import { createBlobStorage } from '#/storage/createBlobStorage.js';

/**
 * Options for the `migrate-avatars` subcommand.
 */
export interface MigrateAvatarsCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;

  /**
   * When true, report work without writing to the object store or database.
   */
  dryRun?: boolean;

  /**
   * Optional tenant id filter; when omitted, all tenants are migrated.
   */
  tenantId?: string;
}

/**
 * Migrates one tenant's hub avatar from base64 DB storage to external object storage.
 *
 * @param rootDb - Root database handle.
 * @param tenantId - Tenant namespace to migrate.
 * @param options - Migration options and blob client.
 * @returns True when a hub avatar was migrated (or would be in dry-run).
 */
async function migrateHubAvatar(
  rootDb: IDatabase,
  tenantId: string,
  options: {
    dryRun: boolean;
    prefix: string;
    blobStorage: ReturnType<typeof createBlobStorage>;
  }
): Promise<boolean> {
  const tenant = await rootDb.findTenantById(tenantId);
  if (
    tenant == null ||
    tenant.avatarImage == null ||
    tenant.avatarImage.length === 0 ||
    tenant.avatarImageMime == null ||
    (tenant.avatarImageKey != null && tenant.avatarImageKey.length > 0)
  ) {
    return false;
  }

  const key = buildHubAvatarObjectKey(options.prefix, tenantId, tenant.avatarImageMime);
  console.log(`  hub avatar → ${key}`);
  if (options.dryRun) {
    return true;
  }

  const bytes = Buffer.from(tenant.avatarImage, 'base64');
  await options.blobStorage.putObject(key, bytes, tenant.avatarImageMime);
  await rootDb.updateTenantAvatar(
    tenantId,
    tenant.avatarInitials ?? 'HH',
    tenant.avatarColor ?? 'sky-600',
    null,
    {
      imageBase64: null,
      imageKey: key,
      mime: tenant.avatarImageMime,
      updatedAt: tenant.avatarImageUpdatedAt ?? new Date()
    }
  );
  return true;
}

/**
 * Migrates user avatars for one tenant from base64 DB storage to external object storage.
 *
 * @param db - Tenant-scoped database handle.
 * @param tenantId - Tenant namespace being migrated.
 * @param options - Migration options and blob client.
 * @returns Count of user avatars migrated (or that would be in dry-run).
 */
async function migrateUserAvatars(
  db: IDatabase,
  tenantId: string,
  options: {
    dryRun: boolean;
    prefix: string;
    blobStorage: ReturnType<typeof createBlobStorage>;
  }
): Promise<number> {
  const users = await db.listUsers();
  let count = 0;

  for (const user of users) {
    if (
      user.avatarImage == null ||
      user.avatarImage.length === 0 ||
      user.avatarImageMime == null ||
      (user.avatarImageKey != null && user.avatarImageKey.length > 0)
    ) {
      continue;
    }

    const key = buildUserAvatarObjectKey(options.prefix, tenantId, user.id, user.avatarImageMime);
    console.log(`  user ${user.id} → ${key}`);
    if (!options.dryRun) {
      const bytes = Buffer.from(user.avatarImage, 'base64');
      await options.blobStorage.putObject(key, bytes, user.avatarImageMime);
      await db.updateUser(
        user.id,
        {
          avatarImage: null,
          avatarImageKey: key,
          avatarImageMime: user.avatarImageMime,
          avatarImageUpdatedAt: user.avatarImageUpdatedAt ?? new Date()
        },
        user.id
      );
    }
    count += 1;
  }

  return count;
}

/**
 * Uploads legacy base64 avatar blobs to the configured object store and stores keys in the DB.
 *
 * @param options - Parsed migrate-avatars command options.
 */
export async function migrateAvatarsCommand(options: MigrateAvatarsCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  if (!isExternalBlobStorage(config.storage)) {
    throw new Error('storage.driver must be "s3" or "gcs" to migrate avatars out of the database.');
  }

  const dryRun = options.dryRun === true;
  const rootDb = createDatabase(config.db);
  const blobStorage = createBlobStorage(config.storage);

  await rootDb.connect();
  await rootDb.migrate();

  try {
    const tenants = options.tenantId
      ? [await rootDb.findTenantById(options.tenantId)].filter(
          (tenant): tenant is NonNullable<typeof tenant> => tenant != null
        )
      : await rootDb.listTenants();

    if (options.tenantId && tenants.length === 0) {
      throw new Error(`Tenant not found: ${options.tenantId}`);
    }

    let hubCount = 0;
    let userCount = 0;

    for (const tenant of tenants) {
      console.log(`${dryRun ? '[dry-run] ' : ''}Migrating avatars for tenant ${tenant.id}…`);
      const shared = {
        dryRun,
        prefix: config.storage.prefix,
        blobStorage
      };

      if (await migrateHubAvatar(rootDb, tenant.id, shared)) {
        hubCount += 1;
      }

      const tenantDb = rootDb.forTenant(tenant.id);
      userCount += await migrateUserAvatars(tenantDb, tenant.id, shared);
    }

    console.log(
      `${dryRun ? 'Dry run complete' : 'Migration complete'}: ${hubCount} hub avatar(s), ${userCount} user avatar(s).`
    );
  } finally {
    await rootDb.disconnect();
  }
}

/**
 * Registers the `migrate-avatars` subcommand on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handler - Action to run when `migrate-avatars` is invoked.
 */
export function registerMigrateAvatarsCommand(
  program: Command,
  handler: (options: MigrateAvatarsCommandOptions) => Promise<void> = migrateAvatarsCommand
): void {
  program
    .command('migrate-avatars')
    .description(
      'Upload legacy base64 avatar blobs to S3/GCS and store object keys in the database'
    )
    .option('--dry-run', 'Report work without writing to storage or the database')
    .option('--tenant-id <id>', 'Migrate a single tenant namespace only')
    .action(
      /**
       * Runs migrate-avatars after merging global CLI options.
       */
      async function migrateAvatarsAction(this: Command, options: MigrateAvatarsCommandOptions) {
        await handler(mergeGlobalOptions(this, options));
      }
    );
}
