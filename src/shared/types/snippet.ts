import type { SnippetScope } from '#/shared/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';

/**
 * Origin of a snippet row in the local registry.
 */
export type SnippetSource = 'local' | 'marketplace';

/**
 * A reusable JavaScript snippet stored in a provider backend or the local
 * marketplace registry.
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
   * Request stages where this snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * Default script stage when the snippet is added to a request stage script list.
   */
  stage: ScriptStage;

  /**
   * Whether the snippet was created locally or imported from the marketplace.
   */
  source: SnippetSource;

  /**
   * Id of the storage connection that stores this snippet.
   *
   * Omitted for marketplace snippets, which remain in the local registry only.
   */
  connectionId?: string;

  /**
   * Marketplace bundle id when `source` is `marketplace`.
   */
  catalogId?: string;

  /**
   * Installed marketplace bundle version when `source` is `marketplace`.
   */
  catalogVersion?: string;

  /**
   * Marketplace bundle publisher when `source` is `marketplace`.
   */
  catalogAuthor?: string;

  /**
   * ISO 8601 timestamp when the snippet was created.
   */
  created_at: string;

  /**
   * ISO 8601 timestamp when the snippet was last updated.
   */
  updated_at: string;
}

/**
 * Portable snippet export file format for git-backed storage.
 */
export interface SnippetExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a snippet export.
   */
  harborclientExport: 'snippet';

  /**
   * Stable portable identifier for deduplication and script references.
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
   * Request stages where this snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * Default script stage when the snippet is added to a request stage script list.
   */
  stage: ScriptStage;

  /**
   * ISO 8601 timestamp when the snippet was created.
   */
  created_at?: string;

  /**
   * ISO 8601 timestamp when the snippet was last updated.
   */
  updated_at?: string;
}
