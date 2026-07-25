import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runSignCli } from './cli.js';
import {
  createTestPluginDir,
  createTestSigningKeys,
  createTestSnippetDir
} from './testFixtures.js';

const SIGNING_KEY_ENV = 'HARBORCLIENT_PLUGIN_SIGNING_KEY';

function withMutedConsole(): () => void {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  return () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  };
}

function restoreSigningKeyEnv(previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[SIGNING_KEY_ENV];
  } else {
    process.env[SIGNING_KEY_ENV] = previousValue;
  }
}

describe('runSignCli', () => {
  it('signs with the environment private key and default dir', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();
    const previousEnv = process.env[SIGNING_KEY_ENV];
    const restoreConsole = withMutedConsole();
    const privateKeyPath = join(dirname(fixture.pluginDir), `${basename(fixture.pluginDir)}.pem`);

    try {
      writeFileSync(privateKeyPath, keys.privateKeyPem);
      process.env[SIGNING_KEY_ENV] = privateKeyPath;

      const exitCode = await runSignCli(['node', 'cli-sign.js'], { cwd: fixture.pluginDir });

      expect(exitCode).toBe(0);
      expect(existsSync(join(fixture.pluginDir, 'signature.json'))).toBe(true);
    } finally {
      restoreConsole();
      restoreSigningKeyEnv(previousEnv);
      rmSync(privateKeyPath, { force: true });
      fixture.cleanup();
    }
  });

  it('falls back to --private-key when the environment is unset', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();
    const previousEnv = process.env[SIGNING_KEY_ENV];
    const restoreConsole = withMutedConsole();
    const privateKeyPath = join(dirname(fixture.pluginDir), `${basename(fixture.pluginDir)}.pem`);

    try {
      writeFileSync(privateKeyPath, keys.privateKeyPem);
      delete process.env[SIGNING_KEY_ENV];

      const exitCode = await runSignCli(['node', 'cli-sign.js', '--private-key', privateKeyPath], {
        cwd: fixture.pluginDir
      });

      expect(exitCode).toBe(0);
      expect(existsSync(join(fixture.pluginDir, 'signature.json'))).toBe(true);
    } finally {
      restoreConsole();
      restoreSigningKeyEnv(previousEnv);
      rmSync(privateKeyPath, { force: true });
      fixture.cleanup();
    }
  });

  it('uses the environment private key before --private-key', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();
    const previousEnv = process.env[SIGNING_KEY_ENV];
    const restoreConsole = withMutedConsole();
    const privateKeyPath = join(dirname(fixture.pluginDir), `${basename(fixture.pluginDir)}.pem`);
    const invalidKeyPath = join(
      dirname(fixture.pluginDir),
      `${basename(fixture.pluginDir)}-invalid.pem`
    );

    try {
      writeFileSync(privateKeyPath, keys.privateKeyPem);
      writeFileSync(invalidKeyPath, 'not-a-key');
      process.env[SIGNING_KEY_ENV] = privateKeyPath;

      const exitCode = await runSignCli(['node', 'cli-sign.js', '--private-key', invalidKeyPath], {
        cwd: fixture.pluginDir
      });

      expect(exitCode).toBe(0);
      expect(existsSync(join(fixture.pluginDir, 'signature.json'))).toBe(true);
    } finally {
      restoreConsole();
      restoreSigningKeyEnv(previousEnv);
      rmSync(privateKeyPath, { force: true });
      rmSync(invalidKeyPath, { force: true });
      fixture.cleanup();
    }
  });

  it('resolves relative plugin and key paths from the provided cwd', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestPluginDir();
    const previousEnv = process.env[SIGNING_KEY_ENV];
    const restoreConsole = withMutedConsole();
    const cwd = dirname(fixture.pluginDir);
    const privateKeyName = `${basename(fixture.pluginDir)}.pem`;
    const privateKeyPath = join(cwd, privateKeyName);

    try {
      writeFileSync(privateKeyPath, keys.privateKeyPem);
      delete process.env[SIGNING_KEY_ENV];

      const exitCode = await runSignCli(
        [
          'node',
          'cli-sign.js',
          '--dir',
          basename(fixture.pluginDir),
          '--private-key',
          privateKeyName
        ],
        { cwd }
      );

      expect(exitCode).toBe(0);
      expect(existsSync(join(fixture.pluginDir, 'signature.json'))).toBe(true);
    } finally {
      restoreConsole();
      restoreSigningKeyEnv(previousEnv);
      rmSync(privateKeyPath, { force: true });
      fixture.cleanup();
    }
  });

  it('signs a snippets-only bundle directory', async () => {
    const keys = createTestSigningKeys();
    const fixture = createTestSnippetDir('com.example.cli-snippet-bundle');
    const previousEnv = process.env[SIGNING_KEY_ENV];
    const restoreConsole = withMutedConsole();
    const privateKeyPath = join(dirname(fixture.pluginDir), `${basename(fixture.pluginDir)}.pem`);

    try {
      writeFileSync(privateKeyPath, keys.privateKeyPem);
      process.env[SIGNING_KEY_ENV] = privateKeyPath;

      const exitCode = await runSignCli(['node', 'cli-sign.js'], { cwd: fixture.pluginDir });

      expect(exitCode).toBe(0);
      expect(existsSync(join(fixture.pluginDir, 'signature.json'))).toBe(true);
    } finally {
      restoreConsole();
      restoreSigningKeyEnv(previousEnv);
      rmSync(privateKeyPath, { force: true });
      fixture.cleanup();
    }
  });
});
