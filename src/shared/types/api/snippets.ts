import type { Snippet } from '#/shared/types/snippet';
import type { SnippetBundleExport } from '#/shared/types/snippet';
import type { SnippetScope } from '#/shared/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';
import type { SnippetCatalog } from '#/shared/snippet/catalog';
import type { InstalledSnippetPackage, SnippetGitPreview } from '#/shared/snippet/types';

/**
 * Result of reading a JavaScript file selected for snippet import.
 */
export type SnippetJsImportResult = {
  /**
   * Discriminator for a single JavaScript file import.
   */
  kind: 'js';

  /**
   * Raw JavaScript source from the selected file.
   */
  code: string;
};

/**
 * Result of reading a snippets bundle JSON file selected for import.
 */
export type SnippetBundleImportResult = {
  /**
   * Discriminator for a snippets bundle JSON import.
   */
  kind: 'bundle';

  /**
   * Parsed snippets bundle export payload.
   */
  bundle: SnippetBundleExport;
};

/**
 * Result of reading a snippet import file from disk.
 */
export type SnippetImportResult = SnippetJsImportResult | SnippetBundleImportResult;

/**
 * IPC methods for reusable JavaScript snippets.
 */
export interface ApiSnippets {
  /**
   * Lists all snippets ordered for settings display.
   *
   * @returns Routed provider snippets merged with local marketplace snippets.
   */
  listSnippets: () => Promise<Snippet[]>;

  /**
   * Creates a new snippet with the given name and code.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @param connectionId - Optional storage connection id; defaults to active storage.
   * @returns The newly created snippet.
   */
  createSnippet: (
    name: string,
    code: string,
    scope: SnippetScope,
    stage?: ScriptStage,
    connectionId?: string
  ) => Promise<Snippet>;

  /**
   * Updates a snippet's name, code, scope, and stage.
   *
   * @param id - Snippet ID to update.
   * @param name - New display name.
   * @param code - Updated JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @param stage - Default stage when added to a script list.
   * @returns The updated snippet.
   */
  updateSnippet: (
    id: number,
    name: string,
    code: string,
    scope: SnippetScope,
    stage?: ScriptStage
  ) => Promise<Snippet>;

  /**
   * Deletes a snippet by id.
   *
   * @param id - Snippet ID to delete.
   */
  deleteSnippet: (id: number) => Promise<void>;

  /**
   * Moves a snippet to another storage provider, keeping its global id stable.
   *
   * @param id - Global snippet id from the registry.
   * @param targetConnectionId - Destination storage connection id.
   * @returns The snippet with updated connection metadata.
   */
  moveSnippet: (id: number, targetConnectionId: string) => Promise<Snippet>;

  /**
   * Opens a native file picker for a `.js` file, or `.js`/`.json` when
   * `includeBundle` is true, and returns its parsed contents.
   *
   * @param includeBundle - When true, the dialog also accepts snippets bundle JSON.
   * @returns Imported source or bundle, or null when the dialog was canceled.
   * @throws When the selected file is empty, invalid, or whitespace-only.
   */
  importSnippetFile: (includeBundle?: boolean) => Promise<SnippetImportResult | null>;

  /**
   * Fetches the public snippet marketplace catalog.
   *
   * @returns Parsed snippet catalog entries.
   */
  getSnippetCatalog: () => Promise<SnippetCatalog>;

  /**
   * Fetches snippets.json and preview assets from a public git repository.
   *
   * @param url - Public repository URL.
   * @param ref - Optional branch or tag.
   * @returns Bundle preview for the marketplace detail modal.
   */
  previewSnippetFromGit: (url: string, ref?: string) => Promise<SnippetGitPreview>;

  /**
   * Installs a snippet bundle by cloning a public git repository.
   *
   * @param url - Public repository URL.
   * @param ref - Optional branch or tag.
   * @returns Installed bundle summary.
   */
  installSnippetFromGit: (url: string, ref?: string) => Promise<InstalledSnippetPackage>;

  /**
   * Opens a native file picker for a `.hcs` or `.zip` snippet bundle and installs it.
   *
   * @returns Installed bundle summary, or null when the dialog was canceled.
   */
  installSnippet: () => Promise<InstalledSnippetPackage | null>;

  /**
   * Installs a snippet bundle from an absolute archive path.
   *
   * @param path - Absolute path to a `.hcs` or `.zip` snippet package.
   * @returns Installed bundle summary.
   */
  installSnippetFromPath: (path: string) => Promise<InstalledSnippetPackage>;

  /**
   * Opens a native directory picker and imports a snippet bundle from disk.
   *
   * @returns Installed bundle summary, or null when the dialog was canceled.
   */
  loadUnpackedSnippet: () => Promise<InstalledSnippetPackage | null>;

  /**
   * Imports a snippet bundle from an absolute directory path.
   *
   * @param path - Absolute path to an unpacked snippet bundle root.
   * @returns Installed bundle summary.
   */
  loadUnpackedSnippetFromPath: (path: string) => Promise<InstalledSnippetPackage>;

  /**
   * Re-clones an installed snippet bundle from its stored git origin.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   * @returns Updated bundle summary.
   */
  updateSnippetFromGit: (catalogId: string) => Promise<InstalledSnippetPackage>;

  /**
   * Removes all snippet rows imported from one marketplace bundle.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   */
  uninstallSnippetPackage: (catalogId: string) => Promise<void>;

  /**
   * Lists installed marketplace snippet bundles grouped from local storage.
   *
   * @returns Installed bundle summaries.
   */
  listInstalledSnippetPackages: () => Promise<InstalledSnippetPackage[]>;
}
