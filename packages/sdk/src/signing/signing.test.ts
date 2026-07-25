import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signPlugin } from './sign.js';
import {
  createTestPluginDir,
  createTestSigningKeys,
  createTestSnippetDir
} from './testFixtures.js';
import { verifyPlugin } from './verify.js';

describe('signPlugin', () => {
  it('writes signature.json for a valid plugin directory', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();

    try {
      const result = await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem: keys.privateKeyPem,
        keyId: 'test-key'
      });

      expect(result.signature.pluginId).toBe('com.example.test-plugin');
      expect(result.signature.pluginVersion).toBe('1.0.0');
      expect(result.signature.keyId).toBe('test-key');
      expect(result.signature.files.map((file) => file.path)).toEqual([
        'dist/renderer.js',
        'manifest.json'
      ]);

      const verification = await verifyPlugin({
        pluginDir: fixture.pluginDir,
        trustedPublicKeysPem: [keys.publicKeyPem]
      });
      expect(verification.status).toBe('valid');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects invalid private keys', async () => {
    const fixture = createTestPluginDir();

    try {
      await expect(
        signPlugin({
          pluginDir: fixture.pluginDir,
          privateKeyPem: 'not-a-key'
        })
      ).rejects.toThrow(/invalid ed25519 private key/i);
    } finally {
      fixture.cleanup();
    }
  });

  it('writes signature.json for a snippets-only bundle directory', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestSnippetDir('com.example.snippets.tester');

    try {
      const result = await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem: keys.privateKeyPem,
        keyId: 'snippet-test-key'
      });

      expect(result.signature.pluginId).toBe('com.example.snippets.tester');
      expect(result.signature.pluginVersion).toBe('1.0.0');
      expect(result.signature.keyId).toBe('snippet-test-key');
      expect(result.signature.files.map((file) => file.path)).toEqual([
        'dist/tester.js',
        'snippets.json'
      ]);

      const verification = await verifyPlugin({
        pluginDir: fixture.pluginDir,
        trustedPublicKeysPem: [keys.publicKeyPem]
      });
      expect(verification.status).toBe('valid');
    } finally {
      fixture.cleanup();
    }
  });
});

describe('verifyPlugin', () => {
  it('returns unsigned when signature.json is absent', async () => {
    const fixture = createTestPluginDir();

    try {
      const result = await verifyPlugin({
        pluginDir: fixture.pluginDir,
        trustedPublicKeysPem: [createTestSigningKeys().publicKeyPem]
      });
      expect(result.status).toBe('unsigned');
    } finally {
      fixture.cleanup();
    }
  });

  it('returns invalid when a signed file is tampered with', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem: keys.privateKeyPem
      });
      writeFileSync(
        join(fixture.pluginDir, 'dist', 'renderer.js'),
        'export function activate() { return 1; }'
      );

      const result = await verifyPlugin({
        pluginDir: fixture.pluginDir,
        trustedPublicKeysPem: [keys.publicKeyPem]
      });
      expect(result.status).toBe('invalid');
      expect(result.error).toMatch(/signed inventory/i);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns invalid when verified with the wrong public key', async () => {
    const keys = createTestSigningKeys();
    const otherKeys = createTestSigningKeys();
    const fixture = createTestPluginDir();

    try {
      await signPlugin({
        pluginDir: fixture.pluginDir,
        privateKeyPem: keys.privateKeyPem
      });

      const result = await verifyPlugin({
        pluginDir: fixture.pluginDir,
        trustedPublicKeysPem: [otherKeys.publicKeyPem]
      });
      expect(result.status).toBe('invalid');
    } finally {
      fixture.cleanup();
    }
  });
});
