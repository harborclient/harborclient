import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import { defaultAuth } from '#/shared/auth';
import type { CollectionExport, ExportedRequest } from '#/shared/types';

/**
 * Local registry key marking that the default echo collection has been seeded or skipped.
 */
export const DEFAULT_ECHO_COLLECTION_SEEDED_KEY = 'defaultEchoCollectionSeeded';

/** Stable UUID for the default HarborClient Echo sample collection. */
export const DEFAULT_ECHO_COLLECTION_UUID = 'a0000000-0000-4000-8000-000000000001';
const DEFAULT_ECHO_GET_UUID = 'a0000000-0000-4000-8000-000000000002';
const DEFAULT_ECHO_POST_UUID = 'a0000000-0000-4000-8000-000000000003';
const DEFAULT_ECHO_PUT_UUID = 'a0000000-0000-4000-8000-000000000004';
const DEFAULT_ECHO_DELETE_UUID = 'a0000000-0000-4000-8000-000000000005';

const ECHO_SAMPLE_JSON_BODY = `{
  "firstName": "{{$randomFirstName}}",
  "lastName": "{{$randomLastName}}",
  "phone": "{{$randomPhoneNumber}}"
}`;

/**
 * Builds a portable export payload for the default HarborClient Echo collection.
 *
 * @returns Collection export ready for {@link RoutingStorage#importCollectionData}.
 */
export function buildDefaultEchoCollectionExport(): CollectionExport {
  const emptyRequestFields = {
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    comment: '',
    tags: ''
  };

  const requests: ExportedRequest[] = [
    {
      uuid: DEFAULT_ECHO_GET_UUID,
      name: 'Echo GET',
      method: 'GET',
      url: 'https://echo.harborclient.com/get',
      params: [{ key: 'guid', value: '{{$guid}}', enabled: true }],
      body: ECHO_SAMPLE_JSON_BODY,
      body_type: 'json',
      sort_order: 0,
      ...emptyRequestFields
    },
    {
      uuid: DEFAULT_ECHO_POST_UUID,
      name: 'Echo POST',
      method: 'POST',
      url: 'https://echo.harborclient.com/post',
      params: [],
      body: ECHO_SAMPLE_JSON_BODY,
      body_type: 'json',
      sort_order: 1,
      ...emptyRequestFields
    },
    {
      uuid: DEFAULT_ECHO_PUT_UUID,
      name: 'Echo PUT',
      method: 'PUT',
      url: 'https://echo.harborclient.com/put',
      params: [],
      body: '',
      body_type: 'none',
      sort_order: 2,
      ...emptyRequestFields
    },
    {
      uuid: DEFAULT_ECHO_DELETE_UUID,
      name: 'Echo DELETE',
      method: 'DELETE',
      url: 'https://echo.harborclient.com/delete',
      params: [],
      body: '',
      body_type: 'none',
      sort_order: 3,
      ...emptyRequestFields
    }
  ];

  return {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: DEFAULT_ECHO_COLLECTION_UUID,
    name: 'HarborClient Echo',
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    requests
  };
}

/**
 * Seeds the default echo collection on first launch when the registry is still empty.
 *
 * Upgrades with existing collections skip seeding but still persist the flag so later
 * startups do not re-check registry state.
 *
 * @param router - Routing storage used to import the collection.
 * @param database - Local registry holding the one-time seed flag.
 */
export async function seedDefaultContentIfNeeded(
  router: RoutingStorage,
  database: LocalDatabase
): Promise<void> {
  if (database.getSetting(DEFAULT_ECHO_COLLECTION_SEEDED_KEY) === '1') {
    return;
  }

  if (database.listRegistry().length > 0) {
    database.setSetting(DEFAULT_ECHO_COLLECTION_SEEDED_KEY, '1');
    return;
  }

  await router.importCollectionData(buildDefaultEchoCollectionExport());
  database.setSetting(DEFAULT_ECHO_COLLECTION_SEEDED_KEY, '1');
}

/**
 * Reads `process.argv` for `--seed` so the flag works in both dev and packaged builds.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when explicit echo seeding was requested on the command line.
 */
export function isSeedFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--seed');
}

/**
 * Imports the HarborClient Echo collection when no registry entry exists for its UUID.
 *
 * @param router - Initialized routing storage with a mounted default data backend.
 * @returns True when a new collection was imported, false when it already existed.
 */
export async function seedEchoCollectionIfMissing(router: RoutingStorage): Promise<boolean> {
  const existing = await router.findCollectionByUuid(DEFAULT_ECHO_COLLECTION_UUID);
  if (existing) {
    return false;
  }

  await router.importCollectionData(buildDefaultEchoCollectionExport());
  return true;
}
