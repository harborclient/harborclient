import { app } from 'electron';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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
  assertFilePathAllowed,
  assertFilePathOpenable,
  assertFilePathWritableDirectory,
  grantFilePathAccess,
  isExecutableFilePath,
  isFilePathAllowed,
  isPathUnderGrantedRoot,
  registerFilePathKnownRootProvider,
  resetFilePathAccessForTests
} from './filePathAccess';

vi.mock('#/main/settings/storageSettings', () => ({
  listStorageConnections: () => mockConnections
}));

let userDataPath = '';
let downloadsPath = '';
let mockConnections: Array<{
  id: string;
  type: string;
  settings: { repoPath?: string };
}> = [];

describe('filePathAccess', () => {
  let scratchDir: string;
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    resetFilePathAccessForTests();
    scratchDir = mkdtempSync(join(tmpdir(), 'harborclient-file-access-'));
    userDataPath = mkdtempSync(join(scratchDir, 'user-data-'));
    downloadsPath = mkdtempSync(join(scratchDir, 'downloads-'));
    mockConnections = [];
    settingsStore = {};

    vi.mocked(app.getPath).mockImplementation((name: string) => {
      if (name === 'userData') {
        return userDataPath;
      }
      if (name === 'downloads') {
        return downloadsPath;
      }
      return join(scratchDir, `mock-${name}`);
    });

    const database = {
      getSetting: (key: string) => settingsStore[key],
      setSetting: (key: string, value: string) => {
        settingsStore[key] = value;
      },
      listLiveServers: () => []
    } as unknown as LocalDatabase;
    setLocalDatabaseForTesting(database);
    setGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS });
  });

  afterEach(() => {
    clearLocalDatabaseForTesting();
    resetFilePathAccessForTests();
    rmSync(scratchDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('treats userData as a known root', () => {
    const nested = join(userDataPath, 'logs', 'app.log');
    expect(isFilePathAllowed(nested)).toBe(true);
    expect(assertFilePathAllowed(nested)).toBe(nested);
  });

  it('rejects paths outside known roots until granted', () => {
    const outside = join(scratchDir, 'secret.txt');
    writeFileSync(outside, 'nope');
    expect(isFilePathAllowed(outside)).toBe(false);
    expect(() => assertFilePathAllowed(outside)).toThrow(/not allowed/);

    grantFilePathAccess(outside);
    expect(isFilePathAllowed(outside)).toBe(true);
  });

  it('allows writes only for grants and the workflow results directory', () => {
    const workflowDir = mkdtempSync(join(scratchDir, 'workflow-'));
    setGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      workflowResultsDirectory: workflowDir
    });

    expect(assertFilePathWritableDirectory(workflowDir)).toBe(workflowDir);
    expect(() => assertFilePathWritableDirectory(userDataPath)).toThrow(/not allowed/);

    const grantedDir = mkdtempSync(join(scratchDir, 'granted-'));
    grantFilePathAccess(grantedDir);
    expect(assertFilePathWritableDirectory(grantedDir)).toBe(grantedDir);
  });

  it('denies opening executable extensions', () => {
    const scriptPath = join(userDataPath, 'payload.sh');
    writeFileSync(scriptPath, '#!/bin/sh\necho hi\n');
    expect(isExecutableFilePath(scriptPath)).toBe(true);
    expect(() => assertFilePathOpenable(scriptPath)).toThrow(/executable/);
  });

  it('denies opening POSIX files with the execute bit set', () => {
    if (process.platform === 'win32') {
      return;
    }
    const binPath = join(userDataPath, 'tool');
    writeFileSync(binPath, 'elf');
    chmodSync(binPath, 0o755);
    expect(isExecutableFilePath(binPath)).toBe(true);
    expect(() => assertFilePathOpenable(binPath)).toThrow(/executable/);
  });

  it('allows opening directories under known roots', () => {
    expect(assertFilePathOpenable(userDataPath)).toBe(userDataPath);
  });

  it('includes provider roots and git repos as known roots', () => {
    const repo = mkdtempSync(join(scratchDir, 'repo-'));
    mockConnections = [{ id: 'git-1', type: 'git', settings: { repoPath: repo } }];
    expect(isFilePathAllowed(join(repo, 'README.md'))).toBe(true);

    const providerRoot = mkdtempSync(join(scratchDir, 'provider-'));
    registerFilePathKnownRootProvider(() => [providerRoot]);
    expect(isFilePathAllowed(join(providerRoot, 'index.html'))).toBe(true);
  });

  it('detects nested paths under a granted root', () => {
    expect(isPathUnderGrantedRoot('/tmp/root', '/tmp/root/a.txt')).toBe(true);
    expect(isPathUnderGrantedRoot('/tmp/root', '/tmp/root')).toBe(true);
    expect(isPathUnderGrantedRoot('/tmp/root', '/tmp/root-other/a.txt')).toBe(false);
  });
});
