import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setPath = vi.hoisted(() => vi.fn());
const mockMkdtempSync = vi.hoisted(() => vi.fn());
const mockRmSync = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    setPath
  }
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdtempSync: mockMkdtempSync,
    rmSync: mockRmSync
  };
});

vi.mock('#/main/logger', () => ({
  logVerbose: vi.fn()
}));

import {
  applyRandUserDirIfRequested,
  cleanupRandUserDir,
  getRandUserDirForCleanup,
  isRandUserDirFlagEnabled
} from './randUserDir';

describe('isRandUserDirFlagEnabled', () => {
  it('returns true when --rand-user-dir is present', () => {
    expect(isRandUserDirFlagEnabled(['electron', '--rand-user-dir'])).toBe(true);
  });

  it('returns false when --rand-user-dir is absent', () => {
    expect(isRandUserDirFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});

describe('applyRandUserDirIfRequested', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    setPath.mockClear();
    mockMkdtempSync.mockClear();
    mockRmSync.mockClear();
    mockMkdtempSync.mockImplementation((prefix: string) => {
      const dirPath = `${prefix}test-${createdDirs.length}`;
      createdDirs.push(dirPath);
      return dirPath;
    });
  });

  afterEach(() => {
    cleanupRandUserDir();
    createdDirs.length = 0;
  });

  it('returns null and does not redirect paths when the flag is absent', () => {
    expect(applyRandUserDirIfRequested(['electron'])).toBeNull();
    expect(setPath).not.toHaveBeenCalled();
    expect(mockMkdtempSync).not.toHaveBeenCalled();
    expect(getRandUserDirForCleanup()).toBeNull();
  });

  it('creates a temp directory and redirects userData and sessionData', () => {
    const dirPath = applyRandUserDirIfRequested(['electron', '--rand-user-dir']);

    expect(dirPath).toBeTruthy();
    expect(mockMkdtempSync).toHaveBeenCalledWith(join(tmpdir(), 'harborclient-'));
    expect(setPath).toHaveBeenCalledWith('userData', dirPath);
    expect(setPath).toHaveBeenCalledWith('sessionData', dirPath);
    expect(getRandUserDirForCleanup()).toBe(dirPath);
  });
});

describe('cleanupRandUserDir', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    setPath.mockClear();
    mockMkdtempSync.mockClear();
    mockRmSync.mockClear();
    mockMkdtempSync.mockImplementation((prefix: string) => {
      const dirPath = `${prefix}cleanup-${createdDirs.length}`;
      createdDirs.push(dirPath);
      return dirPath;
    });
  });

  afterEach(() => {
    cleanupRandUserDir();
    createdDirs.length = 0;
  });

  it('is a no-op when no temporary profile was created', () => {
    cleanupRandUserDir();
    expect(mockRmSync).not.toHaveBeenCalled();
  });

  it('removes the recorded temporary profile directory', () => {
    const dirPath = applyRandUserDirIfRequested(['electron', '--rand-user-dir']);
    expect(dirPath).toBeTruthy();

    cleanupRandUserDir();

    expect(mockRmSync).toHaveBeenCalledWith(dirPath, { recursive: true, force: true });
    expect(getRandUserDirForCleanup()).toBeNull();
  });

  it('is idempotent when called more than once', () => {
    applyRandUserDirIfRequested(['electron', '--rand-user-dir']);

    cleanupRandUserDir();
    cleanupRandUserDir();

    expect(mockRmSync).toHaveBeenCalledTimes(1);
  });

  it('swallows removal failures without throwing', () => {
    const dirPath = applyRandUserDirIfRequested(['electron', '--rand-user-dir']);
    mockRmSync.mockImplementation(() => {
      throw new Error('EBUSY');
    });

    expect(() => cleanupRandUserDir()).not.toThrow();
    expect(mockRmSync).toHaveBeenCalledWith(dirPath, { recursive: true, force: true });
    expect(getRandUserDirForCleanup()).toBeNull();
  });
});
