import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginFsAllowlist, normalizePath, resolveRealPath } from './pluginFsAllowlist';

describe('PluginFsAllowlist', () => {
  let tempDir: string;
  let otherDir: string | undefined;

  afterEach(() => {
    if (otherDir) {
      rmSync(otherDir, { recursive: true, force: true });
      otherDir = undefined;
    }
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
    const outsideDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-other-'));
    otherDir = outsideDir;
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);

    expect(allowlist.isAllowed('com.example.test', outsideDir)).toBe(false);
    expect(() => allowlist.readTextFile('com.example.test', outsideDir)).toThrow(/not allowlisted/);
  });

  it('normalizes paths to absolute form', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const normalized = normalizePath(tempDir);
    expect(normalized).not.toContain('..');
    expect(normalized).toBe(resolve(tempDir));
  });

  it('allows path segments that contain .. as a substring', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const dottedDir = join(tempDir, 'backup..2024');
    mkdirSync(dottedDir, { recursive: true });
    const filePath = join(dottedDir, 'file.txt');

    const normalized = normalizePath(filePath);
    expect(normalized).toBe(resolve(filePath));

    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);
    allowlist.writeTextFile('com.example.test', filePath, 'data');
    expect(allowlist.readTextFile('com.example.test', filePath)).toBe('data');
  });

  it('rejects paths with parent-directory traversal segments', () => {
    expect(() => normalizePath('/a/../b')).toThrow(/Invalid path/);
  });

  it('clears allowlisted paths when a plugin is removed', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);
    allowlist.clearPlugin('com.example.test');
    expect(allowlist.isAllowed('com.example.test', tempDir)).toBe(false);
  });

  it('allows non-existent files under an allowlisted directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);

    const newFile = join(tempDir, 'new-file.txt');
    expect(allowlist.isAllowed('com.example.test', newFile)).toBe(true);
    allowlist.writeTextFile('com.example.test', newFile, 'hello');
    expect(allowlist.readTextFile('com.example.test', newFile)).toBe('hello');
  });

  it('blocks symlink escapes outside the allowlist', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    otherDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-other-'));
    const secretFile = join(otherDir, 'secret.txt');
    writeFileSync(secretFile, 'secret', 'utf-8');

    const symlinkPath = join(tempDir, 'escape-link');
    symlinkSync(secretFile, symlinkPath);

    const allowlist = new PluginFsAllowlist();
    allowlist.seedPluginDirectory('com.example.test', tempDir);

    expect(allowlist.isAllowed('com.example.test', symlinkPath)).toBe(false);
    expect(() => allowlist.readTextFile('com.example.test', symlinkPath)).toThrow(
      /not allowlisted/
    );
    expect(() => allowlist.writeTextFile('com.example.test', symlinkPath, 'pwned')).toThrow(
      /not allowlisted/
    );
  });

  it('resolves symlinks to their canonical target', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-plugin-fs-'));
    const targetFile = join(tempDir, 'target.txt');
    writeFileSync(targetFile, 'data', 'utf-8');

    const symlinkPath = join(tempDir, 'link.txt');
    symlinkSync(targetFile, symlinkPath);

    expect(resolveRealPath(symlinkPath)).toBe(resolveRealPath(targetFile));
  });
});
