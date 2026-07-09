import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, normalize, posix, relative, resolve } from 'path';
import { randomUUID } from 'crypto';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import { tmpdir } from 'os';
import JSZip from 'jszip';
import { assertSafeGitPluginUrl } from '#/main/plugins/gitPluginUrl';
import { PluginSignatureUnavailableError } from '#/main/plugins/pluginSignature';
import { pathHasParentSegment } from '#/main/pathHasParentSegment';
import {
  getGitSnippetOrigins,
  removeGitSnippetOrigin,
  removeInstalledSnippetPackage,
  setGitSnippetOrigin,
  setInstalledSnippetPackage,
  getInstalledSnippetPackages
} from '#/main/snippets/snippetRegistry';
import { evaluateSnippetPackageSignature } from '#/main/snippets/snippetSignature';
import { parseSnippetManifest, validateSnippetManifest } from '#/main/snippets/manifestSchema';
import { resolveMarketplaceSnippetUuid } from '#/main/snippets/snippetUuid';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type { InstalledSnippetPackage } from '#/shared/snippet/types';
import type { PluginSignatureInfo } from '#/shared/plugin/types';
import type { Snippet } from '#/shared/types';

const MANIFEST_FILENAME = 'snippets.json';

/**
 * Installs and updates snippet marketplace bundles by cloning public git repositories
 * and importing snippet rows into the local registry database.
 */
export class SnippetInstaller {
  readonly #appVersion: string;

  /**
   * @param appVersion - Running HarborClient version used for engine checks.
   */
  constructor(appVersion: string) {
    this.#appVersion = appVersion;
  }

  /**
   * Installs a snippet bundle by cloning a public git repository.
   *
   * @param url - Public https (or http) repository URL.
   * @param ref - Optional branch or tag to clone.
   * @returns Installed bundle summary.
   */
  async installFromGit(url: string, ref?: string): Promise<InstalledSnippetPackage> {
    const normalizedUrl = assertSafeGitPluginUrl(url);
    const trimmedRef = ref?.trim() || undefined;
    const tempDir = join(tmpdir(), `harborclient-snippet-clone-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      await git.clone({
        fs,
        http,
        dir: tempDir,
        url: normalizedUrl,
        ref: trimmedRef,
        singleBranch: true,
        depth: 1
      });

      const manifest = this.#readManifest(tempDir);
      const signature = await this.#verifySignature(tempDir, manifest);
      const imported = this.#importManifestSnippets(tempDir, manifest);
      setGitSnippetOrigin(manifest.id, { url: normalizedUrl, ref: trimmedRef });

      const summary = this.#buildPackageSummary(manifest, imported.length, 'git', signature);
      setInstalledSnippetPackage(manifest.id, summary);
      this.#syncInstalledSnippetMetadata();
      return summary;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Installs a snippet bundle from a `.hcs` or `.zip` archive path.
   *
   * @param archivePath - Absolute path to the snippet package archive.
   * @returns Installed bundle summary.
   */
  async installFromFile(archivePath: string): Promise<InstalledSnippetPackage> {
    const buffer = readFileSync(archivePath);
    const zip = await JSZip.loadAsync(new Uint8Array(buffer));
    const manifestEntry = zip.file(MANIFEST_FILENAME);
    if (!manifestEntry) {
      throw new Error('Snippet archive is missing snippets.json.');
    }

    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(await manifestEntry.async('string'));
    } catch {
      throw new Error('Snippet manifest is not valid JSON.');
    }

    const manifest = validateSnippetManifest(manifestRaw, this.#appVersion);
    const tempDir = join(tmpdir(), `harborclient-snippet-file-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      await this.#extractZipSafely(zip, tempDir);
      const extractedManifest = this.#readManifest(tempDir);
      const signature = await this.#verifySignature(tempDir, extractedManifest);
      const imported = this.#importManifestSnippets(tempDir, extractedManifest);
      removeGitSnippetOrigin(manifest.id);

      const summary = this.#buildPackageSummary(
        extractedManifest,
        imported.length,
        'file',
        signature
      );
      setInstalledSnippetPackage(manifest.id, summary);
      this.#syncInstalledSnippetMetadata();
      return summary;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Imports a snippet bundle from an unpacked directory on disk.
   *
   * Signature verification is evaluated for display metadata only and never blocks
   * directory installs, matching plugin load-unpacked.
   *
   * @param directory - Absolute or relative path to the snippet bundle root.
   * @returns Installed bundle summary.
   */
  async loadUnpacked(directory: string): Promise<InstalledSnippetPackage> {
    const absolute = resolve(directory);
    const manifest = this.#readManifest(absolute);
    const imported = this.#importManifestSnippets(absolute, manifest);
    removeGitSnippetOrigin(manifest.id);

    const signature = await this.#evaluateDisplaySignature(absolute, manifest);
    const summary = this.#buildPackageSummary(manifest, imported.length, 'directory', signature);
    setInstalledSnippetPackage(manifest.id, summary);
    this.#syncInstalledSnippetMetadata();
    return summary;
  }

  /**
   * Re-clones a git-installed snippet bundle from its stored origin.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   * @returns Updated bundle summary.
   */
  async updateFromGit(catalogId: string): Promise<InstalledSnippetPackage> {
    const origin = getGitSnippetOrigins()[catalogId];
    if (!origin) {
      throw new Error(`Snippet bundle ${catalogId} was not installed from git.`);
    }

    return this.installFromGit(origin.url, origin.ref);
  }

  /**
   * Removes all marketplace snippet rows imported from one bundle.
   *
   * @param catalogId - Snippet bundle id from snippets.json.
   */
  uninstallPackage(catalogId: string): void {
    getLocalDatabase().deleteSnippetsByCatalogId(catalogId);
    removeGitSnippetOrigin(catalogId);
    removeInstalledSnippetPackage(catalogId);
  }

  /**
   * Groups installed marketplace snippet rows by bundle id.
   *
   * @returns Installed bundle summaries derived from local DB rows.
   */
  listInstalledPackages(): InstalledSnippetPackage[] {
    this.#syncInstalledSnippetMetadata();
    const stored = getInstalledSnippetPackages();
    const snippets = getLocalDatabase()
      .listSnippets()
      .filter((entry) => entry.source === 'marketplace' && entry.catalogId);

    const counts = new Map<string, number>();
    for (const snippet of snippets) {
      if (!snippet.catalogId) {
        continue;
      }
      counts.set(snippet.catalogId, (counts.get(snippet.catalogId) ?? 0) + 1);
    }

    return Object.values(stored).map((entry) => ({
      ...entry,
      snippetCount: counts.get(entry.catalogId) ?? entry.snippetCount
    }));
  }

  /**
   * Reads and validates snippets.json from a cloned repository directory.
   *
   * @param directory - Absolute clone directory.
   * @returns Validated bundle manifest.
   */
  #readManifest(directory: string): ReturnType<typeof validateSnippetManifest> {
    const manifestPath = join(directory, MANIFEST_FILENAME);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error('Snippet repository is missing a valid snippets.json file.');
    }

    return validateSnippetManifest(raw, this.#appVersion);
  }

  /**
   * Verifies bundle signature and blocks untrusted or invalid packages.
   *
   * @param directory - Absolute clone directory.
   * @param manifest - Parsed snippets.json manifest.
   * @returns Signature evaluation metadata for UI display.
   */
  async #verifySignature(
    directory: string,
    manifest: ReturnType<typeof parseSnippetManifest>
  ): Promise<PluginSignatureInfo> {
    let signature;
    try {
      signature = await evaluateSnippetPackageSignature(directory, manifest);
    } catch (error) {
      if (error instanceof PluginSignatureUnavailableError) {
        throw error;
      }
      throw new Error(
        error instanceof Error ? error.message : 'Snippet signature could not be verified.'
      );
    }

    if (signature.status === 'untrusted' || signature.status === 'invalid') {
      throw new Error(signature.error ?? 'Snippet package signature could not be verified.');
    }

    return signature;
  }

  /**
   * Evaluates bundle signature for UI metadata without blocking directory installs.
   *
   * @param directory - Absolute snippet bundle directory.
   * @param manifest - Parsed snippets.json manifest.
   * @returns Signature status for display, or unsigned when verification is unavailable.
   */
  async #evaluateDisplaySignature(
    directory: string,
    manifest: ReturnType<typeof parseSnippetManifest>
  ): Promise<PluginSignatureInfo | undefined> {
    try {
      const signature = await evaluateSnippetPackageSignature(directory, manifest);
      if (signature.status === 'verified' || signature.status === 'unsigned') {
        return signature;
      }

      return { status: 'unsigned', author: manifest.author };
    } catch (error) {
      if (error instanceof PluginSignatureUnavailableError) {
        return manifest.author
          ? { status: 'unsigned', author: manifest.author }
          : { status: 'unsigned' };
      }

      return manifest.author
        ? { status: 'unsigned', author: manifest.author }
        : { status: 'unsigned' };
    }
  }

  /**
   * Backfills marketplace author and source metadata on imported snippet rows.
   */
  #syncInstalledSnippetMetadata(): void {
    const database = getLocalDatabase();
    const packages = getInstalledSnippetPackages();

    for (const pkg of Object.values(packages)) {
      database.ensureMarketplaceSource(pkg.catalogId);
      if (pkg.author?.trim()) {
        database.backfillCatalogAuthor(pkg.catalogId, pkg.author);
      }
    }
  }

  /**
   * Imports or updates all snippet rows declared in one bundle manifest.
   *
   * @param directory - Absolute clone directory.
   * @param manifest - Parsed snippets.json manifest.
   * @returns Imported snippet rows.
   */
  #importManifestSnippets(
    directory: string,
    manifest: ReturnType<typeof parseSnippetManifest>
  ): Snippet[] {
    const database = getLocalDatabase();
    const importedUuids = new Set<string>();
    const imported: Snippet[] = [];

    for (const entry of manifest.snippets) {
      const relativePath = entry.file.replace(/^\/+/, '');
      if (!relativePath || relativePath.includes('..')) {
        throw new Error(`Invalid snippet file path in manifest: ${entry.file}`);
      }

      const filePath = join(directory, relativePath);
      let code: string;
      try {
        code = readFileSync(filePath, 'utf8');
      } catch {
        throw new Error(`Snippet file not found in repository: ${entry.file}`);
      }

      if (!code.trim()) {
        throw new Error(`Snippet file is empty: ${entry.file}`);
      }

      const uuid = resolveMarketplaceSnippetUuid(manifest.id, entry.uuid, entry.name);
      importedUuids.add(uuid);
      imported.push(
        database.upsertMarketplaceSnippet({
          uuid,
          name: entry.name,
          code,
          scope: entry.phase,
          stage: entry['stage'],
          catalogId: manifest.id,
          catalogVersion: manifest.version,
          catalogAuthor: manifest.author
        })
      );
    }

    const existing = database.listMarketplaceSnippetsByCatalogId(manifest.id);
    for (const snippet of existing) {
      if (!importedUuids.has(snippet.uuid)) {
        database.deleteSnippet(snippet.id);
      }
    }

    return imported;
  }

  /**
   * Builds persisted summary metadata for one installed snippet bundle.
   *
   * @param manifest - Parsed snippets.json manifest.
   * @param snippetCount - Number of snippet rows imported from the bundle.
   * @param installSource - How the bundle was installed.
   * @param signature - Publisher signature verification result when available.
   * @returns Installed bundle summary for registry storage.
   */
  #buildPackageSummary(
    manifest: ReturnType<typeof parseSnippetManifest>,
    snippetCount: number,
    installSource: InstalledSnippetPackage['installSource'],
    signature: PluginSignatureInfo | undefined
  ): InstalledSnippetPackage {
    return {
      catalogId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      snippetCount,
      author: manifest.author,
      installSource,
      signature
    };
  }

  /**
   * Extracts all zip entries into a target directory with path-traversal protection.
   *
   * @param zip - Loaded snippet archive.
   * @param targetDir - Absolute directory where entries are written.
   */
  async #extractZipSafely(zip: JSZip, targetDir: string): Promise<void> {
    const entries: Array<{ relativePath: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, file) => {
      entries.push({ relativePath, file });
    });

    const writes: Promise<void>[] = [];
    for (const { relativePath, file } of entries) {
      const absolutePath = this.#assertSafeInstallEntryPath(targetDir, relativePath);
      if (file.dir) {
        mkdirSync(absolutePath, { recursive: true });
        continue;
      }

      writes.push(
        file.async('uint8array').then((bytes) => {
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, bytes);
        })
      );
    }

    await Promise.all(writes);
  }

  /**
   * Validates a zip entry path and returns its safe absolute install destination.
   *
   * @param targetDir - Absolute snippet extract directory.
   * @param relativePath - Zip entry path relative to the archive root.
   * @returns Absolute path where the entry may be written.
   */
  #assertSafeInstallEntryPath(targetDir: string, relativePath: string): string {
    if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\\')) {
      throw new Error(`Snippet archive contains an unsafe path: ${relativePath}`);
    }
    if (/^[A-Za-z]:[/\\]/.test(relativePath)) {
      throw new Error(`Snippet archive contains an unsafe path: ${relativePath}`);
    }

    const normalized = posix.normalize(relativePath.replace(/\\/g, '/'));
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
      throw new Error(`Snippet archive contains an unsafe path: ${relativePath}`);
    }
    if (pathHasParentSegment(normalized)) {
      throw new Error(`Snippet archive contains an unsafe path: ${relativePath}`);
    }

    return this.#resolvePathWithinRoot(targetDir, relativePath);
  }

  /**
   * Resolves a path within a root directory and rejects traversal outside the root.
   *
   * @param rootDir - Absolute root directory.
   * @param relativePath - Path relative to the root.
   * @returns Absolute resolved path within the root.
   */
  #resolvePathWithinRoot(rootDir: string, relativePath: string): string {
    const normalizedRoot = resolve(rootDir);
    const absolutePath = resolve(normalizedRoot, relativePath);
    const rel = relative(normalizedRoot, absolutePath);
    if (rel.startsWith('..') || rel.includes(`..${normalize('/')}`)) {
      throw new Error(`Snippet asset path escapes snippet directory: ${relativePath}`);
    }
    return absolutePath;
  }
}

let installer: SnippetInstaller | null = null;

/**
 * Returns the shared snippet installer instance.
 *
 * @param appVersion - Running HarborClient version used for engine checks.
 */
export function getSnippetInstaller(appVersion: string): SnippetInstaller {
  if (!installer) {
    installer = new SnippetInstaller(appVersion);
  }
  return installer;
}
