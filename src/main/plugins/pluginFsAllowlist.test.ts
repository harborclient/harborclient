import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginFsAllowlist, normalizePath } from '#/main/plugins/pluginFsAllowlist';

describe('PluginFsAllowlist', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('seeds and grants nested paths under the plugin directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);

    const nestedFile = join(tempDir, 'data', 'config.json');
    mkdirSync(dirname(nestedFile), { recursive: true });
    writeFileSync(nestedFile, '{}', 'utf-8');

    expect(allowlist.isAllowed('com.example.test', nestedFile)).toBe(true);
    expect(allowlist.readTextFile('com.example.test', nestedFile)).toBe('{}');
  });

  it('rejects paths outside the allowlist', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const otherDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-other-'));
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);

    expect(allowlist.isAllowed('com.example.test', otherDir)).toBe(false);
    expect(() => allowlist.readTextFile('com.example.test', otherDir)).toThrow(/not allowlisted/);

    rmSync(otherDir, { recursive: true, force: true });
  });

  it('normalizes paths to absolute form', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const normalized = normalizePath(tempDir);
    expect(normalized).not.toContain('..');
    expect(normalized).toBe(resolve(tempDir));
  });

  it('clears allowlisted paths when a plugin is removed', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);
    allowlist.clearPlugin('com.example.test');
    expect(allowlist.isAllowed('com.example.test', tempDir)).toBe(false);
  });
});
