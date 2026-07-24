import JSZip from 'jszip';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT_VERSION,
  LOCAL_STORAGE_PATH,
  MANIFEST_PATH,
  applyBackup,
  buildBackupZip,
  collectBackupFiles,
  isSafeRelativePath,
  validateAndExtractBackup
} from './backupArchive';

const cleanups: Array<() => void> = [];

/**
 * Creates an isolated userData directory for backup tests.
 */
function createUserDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harborclient-backup-'));
  cleanups.push(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('backupArchive', () => {
  it('collects allowlisted userData files', () => {
    const userDataPath = createUserDataDir();
    writeFileSync(join(userDataPath, 'harborclient-registry.db'), 'registry');
    writeFileSync(join(userDataPath, 'settings.json'), '{}');
    writeFileSync(join(userDataPath, 'team-hub-abc.db'), 'hub');
    mkdirSync(join(userDataPath, 'git-index'), { recursive: true });
    writeFileSync(join(userDataPath, 'git-index', 'conn.json'), '{"a":1}');

    const files = collectBackupFiles(userDataPath, []).map((entry) => entry.relativePath);
    expect(files).toContain('harborclient-registry.db');
    expect(files).toContain('settings.json');
    expect(files).toContain('team-hub-abc.db');
    expect(files).toContain('git-index/conn.json');
  });

  it('round-trips a backup archive through applyBackup', async () => {
    const sourcePath = createUserDataDir();
    const targetPath = createUserDataDir();

    writeFileSync(join(sourcePath, 'settings.json'), '{"panelLayout":{}}');
    writeFileSync(join(sourcePath, 'harborclient-registry.db'), 'sqlite-data');

    const localStorage = {
      'harborclient.openTabs': '{"tabs":[]}',
      'hc.sidebarWidth': '280'
    };

    const archive = await buildBackupZip(
      sourcePath,
      localStorage,
      '1.0.0-test',
      () => undefined,
      []
    );
    const extracted = await validateAndExtractBackup(archive);

    expect(extracted.manifest.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(extracted.localStorage).toEqual(localStorage);

    applyBackup(targetPath, extracted);

    expect(readFileSync(join(targetPath, 'settings.json'), 'utf-8')).toBe('{"panelLayout":{}}');
    expect(readFileSync(join(targetPath, 'harborclient-registry.db'), 'utf-8')).toBe('sqlite-data');
  });

  it('rejects unsafe relative paths', () => {
    expect(isSafeRelativePath('../escape.txt')).toBe(false);
    expect(isSafeRelativePath('git-index/conn.json')).toBe(true);
  });

  it('rejects archives with unsafe file paths in the manifest', async () => {
    const zip = new JSZip();
    zip.file(
      MANIFEST_PATH,
      JSON.stringify({
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        platform: 'linux',
        files: ['../escape.txt']
      })
    );
    zip.file('../escape.txt', 'bad');
    zip.file(LOCAL_STORAGE_PATH, '{}');

    const archive = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(validateAndExtractBackup(archive)).rejects.toThrow(/unsafe file path/i);
  });

  it('rejects unsupported backup format versions', async () => {
    const zip = new JSZip();
    zip.file(
      MANIFEST_PATH,
      JSON.stringify({
        backupFormatVersion: 999,
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        platform: 'linux',
        files: []
      })
    );
    zip.file(LOCAL_STORAGE_PATH, '{}');

    const archive = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(validateAndExtractBackup(archive)).rejects.toThrow(/unsupported backup format/i);
  });
});
