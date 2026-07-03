import type { SnippetScope } from '#/shared/snippetScope';

/**
 * A reusable JavaScript snippet stored in the app-global registry.
 */
export interface Snippet {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * Stable portable identifier for deduplication and live references.
   */
  uuid: string;

  /**
   * Display name shown in settings and script pickers.
   */
  name: string;

  /**
   * JavaScript source executed when the snippet is referenced.
   */
  code: string;

  /**
   * Script phases where this snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * ISO 8601 timestamp when the snippet was created.
   */
  created_at: string;

  /**
   * ISO 8601 timestamp when the snippet was last updated.
   */
  updated_at: string;
}
