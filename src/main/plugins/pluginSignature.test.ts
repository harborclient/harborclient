import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signPlugin } from '@harborclient/plugin-api/signing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_TRUSTED_KEYS_URL } from '#/shared/plugin/catalog';

const TEST_AUTHOR = 'Test Publisher';
const TEST_KEY_URL = 'https://example.com/test.key';

let appRoot = '';
let publicKeyPem = '';
let privateKeyPem = '';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => appRoot
  }
}));

/**
 * Creates a temporary app root containing plugins/trusted.json for tests.
 *
 * @returns Absolute path to the temporary app root directory.
 */
function createAppRootWithTrustedKeys(): string {
  const root = mkdtempSync(join(tmpdir(), 'harborclient-plugin-trusted-'));
  const pluginsDir = join(root, 'plugins');
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, 'trusted.json'),
    `${JSON.stringify([{ author: TEST_AUTHOR, key: TEST_KEY_URL }], null, 2)}\n`,
    'utf8'
  );
  return root;
}

/**
 * Creates a minimal plugin directory for signature evaluation tests.
 *
 * @param options - Optional manifest overrides.
 * @returns Plugin directory path and cleanup callback.
 */
function createPluginDir(options: { author?: string | null; pluginId?: string } = {}): {
  pluginDir: string;
  cleanup: () => void;
} {
  const pluginDir = mkdtempSync(join(tmpdir(), 'harborclient-plugin-sign-eval-'));
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  const manifest: Record<string, unknown> = {
    id: options.pluginId ?? 'com.example.test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    engines: { harborclient: '>=1.0.0' },
    renderer: 'dist/renderer.js',
    permissions: ['ui']
  };
  if (options.author !== null) {
    manifest.author = options.author ?? TEST_AUTHOR;
  }
  writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(pluginDir, 'dist', 'renderer.js'), 'export function activate() {}');

  return {
    pluginDir,
    cleanup: () => {
      rmSync(pluginDir, { recursive: true, force: true });
    }
  };
}

/**
 * Installs a fetch stub that serves trusted.json and the test public key PEM.
 */
function mockTrustedRegistryFetch(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === PLUGIN_TRUSTED_KEYS_URL) {
      return new Response(JSON.stringify([{ author: TEST_AUTHOR, key: TEST_KEY_URL }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url === TEST_KEY_URL) {
      return new Response(publicKeyPem, {
        status: 200,
        headers: { 'Content-Type': 'application/x-pem-file' }
      });
    }
    return new Response('', { status: 404 });
  });
}

describe('pluginSignature', () => {
  beforeEach(async () => {
    vi.resetModules();
    const keys = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    publicKeyPem = keys.publicKey;
    privateKeyPem = keys.privateKey;
    appRoot = createAppRootWithTrustedKeys();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (appRoot) {
      rmSync(appRoot, { recursive: true, force: true });
      appRoot = '';
    }
  });

  it('returns unsigned when signature.json is absent and manifest has no author', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fixture = createPluginDir({ author: null });
    const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');

    try {
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      await expect(evaluatePluginSignature(fixture.pluginDir, manifest)).resolves.toEqual({
        status: 'unsigned'
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fixture.cleanup();
    }
  });

  it('returns untrusted when signature.json is absent but manifest claims a trusted publisher', async () => {
    mockTrustedRegistryFetch();
    const fixture = createPluginDir();
    const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');

    try {
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      const result = await evaluatePluginSignature(fixture.pluginDir, manifest);
      expect(result.status).toBe('untrusted');
      expect(result.error).toMatch(/verified publisher/i);
      expect(result.error).toMatch(/not signed/i);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns unsigned when signature.json is absent and manifest author is not trusted', async () => {
    mockTrustedRegistryFetch();
    const fixture = createPluginDir({ author: 'Unknown Publisher' });
    const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');

    try {
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      await expect(evaluatePluginSignature(fixture.pluginDir, manifest)).resolves.toEqual({
        status: 'unsigned'
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('throws when the trusted registry cannot be loaded for an unsigned plugin claiming a trusted publisher', async () => {
    rmSync(join(appRoot, 'plugins'), { recursive: true, force: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const fixture = createPluginDir();

    try {
      const { evaluatePluginSignature, PluginSignatureUnavailableError } =
        await import('#/main/plugins/pluginSignature');
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      await expect(evaluatePluginSignature(fixture.pluginDir, manifest)).rejects.toBeInstanceOf(
        PluginSignatureUnavailableError
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('returns verified for a signed plugin with a trusted publisher key', async () => {
    mockTrustedRegistryFetch();
    const fixture = createPluginDir();

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem,
        keyId: 'test-key'
      });

      const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      await expect(evaluatePluginSignature(fixture.pluginDir, manifest)).resolves.toEqual({
        status: 'verified',
        author: TEST_AUTHOR,
        keyId: 'test-key'
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('returns invalid when a signed file is tampered with', async () => {
    mockTrustedRegistryFetch();
    const fixture = createPluginDir();

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem,
        keyId: 'test-key'
      });
      writeFileSync(
        join(fixture.pluginDir, 'dist', 'renderer.js'),
        'export function activate() { return 1; }'
      );

      const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      const result = await evaluatePluginSignature(fixture.pluginDir, manifest);
      expect(result.status).toBe('invalid');
      expect(result.error).toMatch(/signed inventory/i);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns untrusted when the publisher author is not registered', async () => {
    mockTrustedRegistryFetch();
    const fixture = createPluginDir({ author: 'Unknown Publisher' });

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem,
        keyId: 'test-key'
      });

      const { evaluatePluginSignature } = await import('#/main/plugins/pluginSignature');
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      const result = await evaluatePluginSignature(fixture.pluginDir, manifest);
      expect(result.status).toBe('untrusted');
      expect(result.error).toMatch(/No trusted signing key/i);
    } finally {
      fixture.cleanup();
    }
  });

  it('throws when the trusted registry cannot be loaded for a signed plugin', async () => {
    rmSync(join(appRoot, 'plugins'), { recursive: true, force: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const fixture = createPluginDir();

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem,
        keyId: 'test-key'
      });

      const { evaluatePluginSignature, PluginSignatureUnavailableError } =
        await import('#/main/plugins/pluginSignature');
      const manifest = JSON.parse(readFileSync(join(fixture.pluginDir, 'manifest.json'), 'utf8'));
      await expect(evaluatePluginSignature(fixture.pluginDir, manifest)).rejects.toBeInstanceOf(
        PluginSignatureUnavailableError
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('fetchTrustedKeys falls back to the local trusted.json file', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    const { fetchTrustedKeys } = await import('#/main/plugins/pluginSignature');
    await expect(fetchTrustedKeys()).resolves.toEqual([{ author: TEST_AUTHOR, key: TEST_KEY_URL }]);
  });
});
