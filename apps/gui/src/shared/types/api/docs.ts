import type { SearchDocsToolArgs } from '#/shared/ai/tools';

/**
 * IPC methods for documentation vector search.
 */
export interface ApiDocs {
  /**
   * Searches HarborClient site and SDK documentation for the AI assistant.
   *
   * @param args - Query text and optional limit/source filter.
   * @returns JSON string of ranked documentation hits or an error object.
   */
  searchDocs: (args: SearchDocsToolArgs) => Promise<string>;
}
