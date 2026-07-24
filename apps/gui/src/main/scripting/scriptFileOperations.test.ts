import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { DEFAULT_GENERAL_SETTINGS, setGeneralSettings } from '#/main/settings/generalSettings';
import {
  executeScriptFileRequest,
  parseCsvText,
  parseYamlText,
  resolveScriptFilePath,
  resolveScriptFileRoot,
  SCRIPT_FILE_MAX_BYTES,
  stringifyCsvText,
  stringifyYamlText
} from './scriptFileOperations';

vi.mock('#/main/settings/storageSettings', () => ({
  listStorageConnections: () => mockConnections
}));

let mockConnections: Array<{
  id: string;
  type: string;
  settings: { repoPath?: string; subdir?: string };
}> = [];

describe('scriptFileOperations', () => {
  let rootDir: string;
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'harborclient-script-fs-'));
    settingsStore = {};
    mockConnections = [];
    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      }
    } as LocalDatabase;
    setLocalDatabaseForTesting(database);
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      scriptFileRoot: rootDir
    });
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    rmSync(rootDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('resolves scriptFileRoot from settings', () => {
    expect(resolveScriptFileRoot()).toBe(rootDir);
  });

  it('uses git repoPath when the collection connection is git-backed', () => {
    const repo = mkdtempSync(join(tmpdir(), 'harborclient-git-repo-'));
    mockConnections = [
      {
        id: 'git-1',
        type: 'git',
        settings: { repoPath: repo, subdir: '.harborclient' }
      }
    ];

    expect(resolveScriptFileRoot({ connectionId: 'git-1' })).toBe(repo);
    rmSync(repo, { recursive: true, force: true });
  });

  it('rejects paths that escape the root', () => {
    expect(() => resolveScriptFilePath(rootDir, '../outside.txt')).toThrow(/Invalid path|outside/);
  });

  it('round-trips JSON read and write', () => {
    executeScriptFileRequest({
      op: 'writeJson',
      path: 'nested/config.json',
      value: { ok: true, n: 2 }
    });
    const value = executeScriptFileRequest({ op: 'readJson', path: 'nested/config.json' });
    expect(value).toEqual({ ok: true, n: 2 });
    expect(readFileSync(join(rootDir, 'nested/config.json'), 'utf8')).toContain('"ok": true');
  });

  it('round-trips YAML read and write', () => {
    executeScriptFileRequest({
      op: 'writeYaml',
      path: 'config.yaml',
      value: { name: 'Ada', roles: ['admin'] }
    });
    expect(executeScriptFileRequest({ op: 'readYaml', path: 'config.yaml' })).toEqual({
      name: 'Ada',
      roles: ['admin']
    });
  });

  it('round-trips CSV with headers', () => {
    executeScriptFileRequest({
      op: 'writeCsv',
      path: 'users.csv',
      value: [
        { id: '1', name: 'Ada' },
        { id: '2', name: 'Grace' }
      ]
    });
    expect(executeScriptFileRequest({ op: 'readCsv', path: 'users.csv' })).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' }
    ]);
  });

  it('supports exists, stat, append, and bytes', () => {
    expect(executeScriptFileRequest({ op: 'exists', path: 'missing.txt' })).toBe(false);
    expect(executeScriptFileRequest({ op: 'stat', path: 'missing.txt' })).toBeNull();

    executeScriptFileRequest({ op: 'writeText', path: 'note.txt', contents: 'hello' });
    executeScriptFileRequest({ op: 'append', path: 'note.txt', contents: ' world' });
    expect(executeScriptFileRequest({ op: 'readText', path: 'note.txt' })).toBe('hello world');
    expect(executeScriptFileRequest({ op: 'exists', path: 'note.txt' })).toBe(true);

    const stat = executeScriptFileRequest({ op: 'stat', path: 'note.txt' }) as {
      size: number;
      isFile: boolean;
    };
    expect(stat.isFile).toBe(true);
    expect(stat.size).toBeGreaterThan(0);

    const bytes = new Uint8Array([1, 2, 3]);
    executeScriptFileRequest({ op: 'writeBytes', path: 'bin.dat', bytes });
    expect(executeScriptFileRequest({ op: 'readBytes', path: 'bin.dat' })).toEqual(bytes);
  });

  it('parses and stringifies YAML/CSV in memory without a path', () => {
    expect(parseYamlText('a: 1\nb: [2, 3]')).toEqual({ a: 1, b: [2, 3] });
    expect(stringifyYamlText({ a: 1 })).toContain('a: 1');
    expect(parseCsvText('id,name\n1,Ada', { headers: true })).toEqual([{ id: '1', name: 'Ada' }]);
    expect(stringifyCsvText([{ id: '1', name: 'Ada' }])).toContain('id,name');

    expect(executeScriptFileRequest({ op: 'parseYaml', contents: 'token: abc' })).toEqual({
      token: 'abc'
    });
    expect(
      executeScriptFileRequest({
        op: 'stringifyCsv',
        value: [{ a: '1' }],
        options: { headers: ['a'] }
      })
    ).toContain('a');
  });

  it('rejects oversized reads', () => {
    const bigPath = join(rootDir, 'big.bin');
    writeFileSync(bigPath, new Uint8Array(SCRIPT_FILE_MAX_BYTES + 1));
    expect(() => executeScriptFileRequest({ op: 'readBytes', path: 'big.bin' })).toThrow(
      /byte limit/
    );
  });

  it('creates parent directories on write', () => {
    executeScriptFileRequest({
      op: 'writeText',
      path: 'a/b/c.txt',
      contents: 'nested'
    });
    expect(readFileSync(join(rootDir, 'a/b/c.txt'), 'utf8')).toBe('nested');
    mkdirSync(join(rootDir, 'a/b'), { recursive: true });
  });
});
