import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnippetInstaller } from '#/main/snippets/SnippetInstaller';
import {
  clearSnippetRegistryForTesting,
  setInstalledSnippetPackage
} from '#/main/snippets/snippetRegistry';
import * as snippetSignature from '#/main/snippets/snippetSignature';
import {
  clearLocalDatabaseForTesting,
  getLocalDatabase,
  initLocalDatabase,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
import { describeSqlite } from '#/test/nativeModules';

const cleanups: Array<() => void | Promise<void>> = [];
const TEST_BUNDLE_ID = 'com.example.snippet-bundle';
const APP_VERSION = '1.6.2';

/**
 * Creates an isolated registry database and snippet installer for tests.
 */
async function createInstaller(): Promise<{
  installer: SnippetInstaller;
  rootDir: string;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-snippets-'));
  await initLocalDatabase(rootDir);
  const installer = new SnippetInstaller(APP_VERSION);
  cleanups.push(async () => {
    await getLocalDatabase().close();
    rmSync(rootDir, { recursive: true, force: true });
  });
  return { installer, rootDir };
}

/**
 * Builds a minimal valid snippet archive buffer for install tests.
 *
 * @param extraEntries - Additional zip paths and payloads to include.
 */
async function buildSnippetArchive(
  extraEntries: Array<{ path: string; content: string }> = []
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'snippets.json',
    JSON.stringify({
      id: TEST_BUNDLE_ID,
      name: 'Archive Snippets',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      snippets: [{ name: 'Hello', where: 'pre-request', file: 'hello.js' }]
    })
  );
  zip.file('hello.js', "console.log('hello');");
  for (const entry of extraEntries) {
    zip.file(entry.path, entry.content);
  }
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

/**
 * Writes a snippet archive buffer to a temp file path.
 *
 * @param archive - Snippet archive contents.
 */
async function writeArchiveFile(archive: Buffer): Promise<string> {
  const archivePath = join(tmpdir(), `harborclient-snippet-${Date.now()}.hcs`);
  writeFileSync(archivePath, new Uint8Array(archive));
  cleanups.push(() => {
    rmSync(archivePath, { force: true });
  });
  return archivePath;
}

/**
 * Writes a minimal unpacked snippet bundle directory for load-unpacked tests.
 *
 * @param rootDir - userData root.
 */
function writeSnippetBundle(rootDir: string): string {
  const bundleDir = join(rootDir, 'snippet-bundle');
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(
    join(bundleDir, 'snippets.json'),
    JSON.stringify({
      id: TEST_BUNDLE_ID,
      name: 'Unpacked Snippets',
      version: '1.0.0',
      author: 'HarborClient',
      engines: { harborclient: '>=1.0.0' },
      snippets: [{ name: 'World', where: 'post-request', file: 'world.js' }]
    })
  );
  writeFileSync(join(bundleDir, 'world.js'), "console.log('world');");
  return bundleDir;
}

beforeEach(() => {
  clearSnippetRegistryForTesting();
});

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
  clearSnippetRegistryForTesting();
  clearLocalDatabaseForTesting();
});

describeSqlite('SnippetInstaller', () => {
  it('installs a snippet bundle from a .hcs archive and imports rows into the database', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'unsigned'
    });

    const { installer } = await createInstaller();
    const archivePath = await writeArchiveFile(await buildSnippetArchive());

    const summary = await installer.installFromFile(archivePath);

    expect(summary.catalogId).toBe(TEST_BUNDLE_ID);
    expect(summary.installSource).toBe('file');
    expect(summary.snippetCount).toBe(1);
    expect(summary.signature?.status).toBe('unsigned');

    const snippets = getLocalDatabase()
      .listSnippets()
      .filter((entry) => entry.catalogId === TEST_BUNDLE_ID);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.name).toBe('Hello');
    expect(snippets[0]?.source).toBe('marketplace');
  });

  it('persists verified signature metadata when installing from a .hcs archive', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'verified',
      author: 'HarborClient',
      keyId: 'test-key'
    });

    const { installer } = await createInstaller();
    const archivePath = await writeArchiveFile(await buildSnippetArchive());

    const summary = await installer.installFromFile(archivePath);

    expect(summary.signature?.status).toBe('verified');
    expect(summary.signature?.author).toBe('HarborClient');
  });

  it('rejects snippet archives with zip-slip paths', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'unsigned'
    });

    const { installer, rootDir } = await createInstaller();
    const archivePath = await writeArchiveFile(
      await buildSnippetArchive([{ path: '../../escape.js', content: 'pwned' }])
    );
    const outsidePath = join(rootDir, 'escape.js');

    await expect(installer.installFromFile(archivePath)).rejects.toThrow(/unsafe path/i);
    expect(existsSync(outsidePath)).toBe(false);
    expect(
      getLocalDatabase()
        .listSnippets()
        .filter((entry) => entry.catalogId === TEST_BUNDLE_ID)
    ).toHaveLength(0);
  });

  it('rejects snippet archives with invalid signatures', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'invalid',
      error: 'Snippet package signature failed verification.'
    });

    const { installer } = await createInstaller();
    const archivePath = await writeArchiveFile(await buildSnippetArchive());

    await expect(installer.installFromFile(archivePath)).rejects.toThrow(
      /signature failed verification/i
    );
    expect(
      getLocalDatabase()
        .listSnippets()
        .filter((entry) => entry.catalogId === TEST_BUNDLE_ID)
    ).toHaveLength(0);
  });

  it('loads an unpacked snippet bundle and evaluates signature for display only', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'unsigned',
      author: 'HarborClient'
    });

    const { installer, rootDir } = await createInstaller();
    const bundleDir = writeSnippetBundle(rootDir);

    const summary = await installer.loadUnpacked(bundleDir);

    expect(snippetSignature.evaluateSnippetPackageSignature).toHaveBeenCalled();
    expect(summary.catalogId).toBe(TEST_BUNDLE_ID);
    expect(summary.installSource).toBe('directory');
    expect(summary.snippetCount).toBe(1);
    expect(summary.author).toBe('HarborClient');
    expect(summary.signature?.status).toBe('unsigned');

    const snippets = getLocalDatabase()
      .listSnippets()
      .filter((entry) => entry.catalogId === TEST_BUNDLE_ID);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.name).toBe('World');
    expect(snippets[0]?.catalogAuthor).toBe('HarborClient');
  });

  it('persists verified signature metadata when loading an unpacked bundle', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'verified',
      author: 'HarborClient',
      keyId: 'test-key'
    });

    const { installer, rootDir } = await createInstaller();
    const bundleDir = writeSnippetBundle(rootDir);

    const summary = await installer.loadUnpacked(bundleDir);

    expect(summary.signature?.status).toBe('verified');
    expect(summary.signature?.author).toBe('HarborClient');
  });

  it('still installs unpacked bundles when signature evaluation reports invalid', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'invalid',
      error: 'Snippet package signature failed verification.'
    });

    const { installer, rootDir } = await createInstaller();
    const bundleDir = writeSnippetBundle(rootDir);

    const summary = await installer.loadUnpacked(bundleDir);

    expect(summary.signature?.status).toBe('unsigned');
    expect(summary.author).toBe('HarborClient');
    expect(
      getLocalDatabase()
        .listSnippets()
        .filter((entry) => entry.catalogId === TEST_BUNDLE_ID)
    ).toHaveLength(1);
  });

  it('throws when loadUnpacked is given a directory without snippets.json', async () => {
    const { installer, rootDir } = await createInstaller();
    const emptyDir = join(rootDir, 'empty-bundle');
    mkdirSync(emptyDir, { recursive: true });

    await expect(installer.loadUnpacked(emptyDir)).rejects.toThrow(/snippets\.json/i);
  });

  it('throws when installFromFile archive is missing snippets.json', async () => {
    const { installer } = await createInstaller();
    const zip = new JSZip();
    zip.file('hello.js', "console.log('hello');");
    const archivePath = await writeArchiveFile(
      Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
    );

    await expect(installer.installFromFile(archivePath)).rejects.toThrow(/missing snippets\.json/i);
  });

  it('backfills snippet author metadata from installed package summaries on list', async () => {
    vi.spyOn(snippetSignature, 'evaluateSnippetPackageSignature').mockResolvedValue({
      status: 'unsigned'
    });

    const { installer } = await createInstaller();
    getLocalDatabase().upsertMarketplaceSnippet({
      uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      name: 'Legacy import',
      code: "console.log('legacy');",
      scope: 'any',
      catalogId: TEST_BUNDLE_ID,
      catalogVersion: '1.0.0'
    });

    setInstalledSnippetPackage(TEST_BUNDLE_ID, {
      catalogId: TEST_BUNDLE_ID,
      name: 'Unpacked Snippets',
      version: '1.0.0',
      snippetCount: 1,
      author: 'HarborClient',
      installSource: 'directory'
    });

    installer.listInstalledPackages();

    const snippets = getLocalDatabase()
      .listSnippets()
      .filter((entry) => entry.catalogId === TEST_BUNDLE_ID);
    expect(snippets[0]?.catalogAuthor).toBe('HarborClient');
    expect(snippets[0]?.source).toBe('marketplace');
  });
});

describe('SnippetInstaller engine checks', () => {
  it('rejects bundles whose engine requirement exceeds the running app version', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-snippets-engine-'));
    const database = new LocalDatabase(rootDir);
    await database.init();
    setLocalDatabaseForTesting(database);
    cleanups.push(async () => {
      await database.close();
      rmSync(rootDir, { recursive: true, force: true });
    });

    const installer = new SnippetInstaller('0.1.0');
    const bundleDir = join(rootDir, 'snippet-bundle');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(
      join(bundleDir, 'snippets.json'),
      JSON.stringify({
        id: TEST_BUNDLE_ID,
        name: 'Future Snippets',
        version: '1.0.0',
        engines: { harborclient: '>=99.0.0' },
        snippets: [{ name: 'Future', where: 'any', file: 'future.js' }]
      })
    );
    writeFileSync(join(bundleDir, 'future.js'), "console.log('future');");

    await expect(installer.loadUnpacked(bundleDir)).rejects.toThrow(/requires HarborClient/i);
  });
});
