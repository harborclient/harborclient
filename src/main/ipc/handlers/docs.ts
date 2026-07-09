import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { searchDocs } from '#/main/docs/docsSearch';
import { logVerbose } from '#/main/logger';

/**
 * Registers IPC handlers for documentation vector search.
 */
export function registerDocsHandlers(): void {
  handle('docs:search', ipcArgSchemas.searchDocs, async (_event, args) => {
    try {
      const hits = await searchDocs(args);
      return JSON.stringify(hits);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Documentation search failed.';
      logVerbose('[docs-search] failed', message);
      return JSON.stringify({ error: message });
    }
  });
}
