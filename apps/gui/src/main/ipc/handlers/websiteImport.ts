import type { ImportAction, Website } from '@harborclient/core/types';
import { defaultAuth } from '@harborclient/core/auth';
import { validateWebsiteExport } from '@harborclient/core/types/website';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';

/**
 * Result of importing a website export into the local registry.
 */
export interface WebsiteImportResult {
  /**
   * Imported or updated website row.
   */
  website: Website;

  /**
   * Whether the website was created or updated.
   */
  action: ImportAction;
}

/**
 * Imports a HarborClient website export into the local registry.
 *
 * When a website with the same uuid already exists it is updated in place;
 * otherwise a new website is created.
 *
 * @param parsed - Parsed JSON payload from the import file.
 * @param db - Active storage facade used for routed imports.
 * @returns Import result, or null when validation fails.
 */
export async function importWebsiteData(
  parsed: unknown,
  db: IStorage
): Promise<WebsiteImportResult | null> {
  let exportData;
  try {
    exportData = validateWebsiteExport(parsed);
  } catch {
    return null;
  }

  const router = db instanceof RoutingStorage ? db : null;
  const database = getLocalDatabase();
  const existing = (router ? await router.listLivePages() : database.listWebsites()).find(
    (item) => item.uuid === exportData.uuid
  );
  const scripts = exportData.scripts ?? [];
  const preRequestScripts = exportData.pre_request_scripts ?? [];
  const postRequestScripts = exportData.post_request_scripts ?? [];
  const variables = exportData.variables ?? [];
  const headers = exportData.headers ?? [];
  const userAgent = exportData.userAgent ?? '';
  const auth = exportData.auth ?? defaultAuth();

  if (existing) {
    const input = {
      id: existing.id,
      name: exportData.name,
      url: exportData.url,
      homeUrl: exportData.homeUrl,
      faviconDataUrl: exportData.faviconDataUrl ?? null,
      scripts,
      preRequestScripts,
      postRequestScripts,
      variables,
      headers,
      userAgent,
      auth
    };
    const website = router
      ? await router.updateLivePage(input)
      : database.updateWebsite(input).find((item) => item.id === existing.id);
    if (!website) {
      return null;
    }
    return { website, action: 'updated' };
  }

  const input = {
    uuid: exportData.uuid,
    name: exportData.name,
    url: exportData.url,
    homeUrl: exportData.homeUrl,
    faviconDataUrl: exportData.faviconDataUrl ?? null,
    scripts,
    preRequestScripts,
    postRequestScripts,
    variables,
    headers,
    userAgent,
    auth
  };
  const website = router
    ? await router.createLivePage(input)
    : database.createWebsite(input).find((item) => item.uuid === exportData.uuid);
  if (!website) {
    return null;
  }
  return { website, action: 'created' };
}
