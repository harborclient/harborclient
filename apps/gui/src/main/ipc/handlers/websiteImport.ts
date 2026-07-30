import type { ImportAction, Website } from '@harborclient/core/types';
import { validateWebsiteExport } from '@harborclient/core/types/website';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';

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
 * @returns Import result, or null when validation fails.
 */
export function importWebsiteData(parsed: unknown): WebsiteImportResult | null {
  let exportData;
  try {
    exportData = validateWebsiteExport(parsed);
  } catch {
    return null;
  }

  const database = getLocalDatabase();
  const existing = database.listWebsites().find((item) => item.uuid === exportData.uuid);
  const scripts = exportData.scripts ?? [];
  const preRequestScripts = exportData.pre_request_scripts ?? [];
  const postRequestScripts = exportData.post_request_scripts ?? [];

  if (existing) {
    const items = database.updateWebsite({
      id: existing.id,
      name: exportData.name,
      url: exportData.url,
      homeUrl: exportData.homeUrl,
      faviconDataUrl: exportData.faviconDataUrl ?? null,
      scripts,
      preRequestScripts,
      postRequestScripts
    });
    const website = items.find((item) => item.id === existing.id);
    if (!website) {
      return null;
    }
    return { website, action: 'updated' };
  }

  const items = database.createWebsite({
    uuid: exportData.uuid,
    name: exportData.name,
    url: exportData.url,
    homeUrl: exportData.homeUrl,
    faviconDataUrl: exportData.faviconDataUrl ?? null,
    scripts,
    preRequestScripts,
    postRequestScripts
  });
  const website = items.find((item) => item.uuid === exportData.uuid);
  if (!website) {
    return null;
  }
  return { website, action: 'created' };
}
