import type { PluginSignatureInfo } from '#/shared/plugin/types';
import type { SnippetCatalogSnippetEntry } from './catalog';

/**
 * Git origin metadata for one installed snippet marketplace bundle.
 */
export interface GitSnippetOrigin {
  /**
   * Public repository URL used for install and update.
   */
  url: string;

  /**
   * Optional branch or tag pinned at install time.
   */
  ref?: string;
}

/**
 * Summary of one installed snippet marketplace bundle grouped from local DB rows.
 */
export interface InstalledSnippetPackage {
  /**
   * Marketplace bundle id from snippets.json.
   */
  catalogId: string;

  /**
   * Display name from the bundle manifest.
   */
  name: string;

  /**
   * Installed bundle version.
   */
  version: string;

  /**
   * Number of snippet rows imported from this bundle.
   */
  snippetCount: number;

  /**
   * Publisher name when known.
   */
  author?: string;

  /**
   * How this bundle was installed. Omitted for bundles installed before this field existed.
   */
  installSource?: 'git' | 'file' | 'directory';

  /**
   * Publisher signature verification result when available.
   */
  signature?: PluginSignatureInfo;
}

/**
 * Preview payload fetched from a public git repository before install.
 */
export interface SnippetGitPreview {
  /**
   * Bundle id from snippets.json.
   */
  id: string;

  /**
   * Bundle display name.
   */
  name: string;

  /**
   * Bundle version.
   */
  version: string;

  /**
   * One-line marketplace summary.
   */
  summary: string;

  /**
   * Publisher name when declared in the manifest.
   */
  author?: string;

  /**
   * Inlined README markdown when available.
   */
  descriptionMarkdown?: string;

  /**
   * Resolved screenshot sources for the detail modal.
   */
  screenshotSrcs: string[];

  /**
   * Snippet entries declared in the bundle manifest.
   */
  snippets: SnippetCatalogSnippetEntry[];

  /**
   * Signature evaluation from the cloned or previewed directory when available.
   */
  signature?: PluginSignatureInfo;
}
