import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isAbsoluteRepoPath,
  isGitDirectoryPath,
  resolveRepoRelativePath
} from './repoRelativePath';

const cleanups: Array<() => void> = [];

/**
 * Creates a temporary directory that is removed after each test.
 *
 * @returns Absolute path to the new temporary directory.
 */
function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harborclient-repo-path-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('isAbsoluteRepoPath', () => {
  /**
   * Confirms relative paths are accepted.
   */
  it('returns false for relative paths', () => {
    expect(isAbsoluteRepoPath('.harborclient/req.json')).toBe(false);
    expect(isAbsoluteRepoPath('backup..2024/file.txt')).toBe(false);
  });

  /**
   * Confirms POSIX and Windows absolute forms are rejected.
   */
  it('returns true for absolute paths', () => {
    expect(isAbsoluteRepoPath('/etc/passwd')).toBe(true);
    expect(isAbsoluteRepoPath('C:\\Windows\\x')).toBe(true);
    expect(isAbsoluteRepoPath('C:/Windows/x')).toBe(true);
    expect(isAbsoluteRepoPath('//server/share')).toBe(true);
  });
});

describe('isGitDirectoryPath', () => {
  /**
   * Confirms `.git` roots and nested paths are detected.
   */
  it('detects .git as the first path segment', () => {
    expect(isGitDirectoryPath('.git')).toBe(true);
    expect(isGitDirectoryPath('.git/config')).toBe(true);
    expect(isGitDirectoryPath('.git\\config')).toBe(true);
  });

  /**
   * Confirms non-.git paths including names that only contain the substring.
   */
  it('returns false for non-.git paths', () => {
    expect(isGitDirectoryPath('.harborclient/req.json')).toBe(false);
    expect(isGitDirectoryPath('not.git/config')).toBe(false);
  });
});

describe('resolveRepoRelativePath', () => {
  /**
   * Accepts a normal HarborClient-tree relative path.
   */
  it('resolves an in-repo relative path', () => {
    const repoDir = createTempDir();
    mkdirSync(join(repoDir, '.harborclient', 'collection-api'), { recursive: true });
    writeFileSync(join(repoDir, '.harborclient', 'collection-api', 'req.json'), '{"ok":true}');

    const resolved = resolveRepoRelativePath(repoDir, '.harborclient/collection-api/req.json');
    expect(resolved.relative).toBe('.harborclient/collection-api/req.json');
    expect(resolved.absolute).toBe(
      realpathSync(join(repoDir, '.harborclient', 'collection-api', 'req.json'))
    );
    expect(readFileSync(resolved.absolute, 'utf-8')).toBe('{"ok":true}');
  });

  /**
   * Allows `..` as a substring of a segment name, not as a parent segment.
   */
  it('allows segment names that contain .. as a substring', () => {
    const repoDir = createTempDir();
    mkdirSync(join(repoDir, 'backup..2024'), { recursive: true });
    writeFileSync(join(repoDir, 'backup..2024', 'file.txt'), 'ok');

    const resolved = resolveRepoRelativePath(repoDir, 'backup..2024/file.txt');
    expect(resolved.relative).toBe('backup..2024/file.txt');
    expect(readFileSync(resolved.absolute, 'utf-8')).toBe('ok');
  });

  /**
   * Rejects empty and whitespace-only paths with the existing empty message.
   */
  it('rejects empty paths', () => {
    const repoDir = createTempDir();
    expect(() => resolveRepoRelativePath(repoDir, '')).toThrow('File path is required.');
    expect(() => resolveRepoRelativePath(repoDir, '   ')).toThrow('File path is required.');
  });

  /**
   * Rejects parent-directory traversal in POSIX and Windows separators.
   */
  it('rejects parent-directory segments', () => {
    const repoDir = createTempDir();
    expect(() => resolveRepoRelativePath(repoDir, '../escape.txt')).toThrow(
      /Invalid repository file path/
    );
    expect(() => resolveRepoRelativePath(repoDir, '..\\escape.txt')).toThrow(
      /Invalid repository file path/
    );
    expect(() => resolveRepoRelativePath(repoDir, '.harborclient/../escape.txt')).toThrow(
      /Invalid repository file path/
    );
  });

  /**
   * Rejects absolute paths that would otherwise join under the repo root.
   */
  it('rejects absolute paths', () => {
    const repoDir = createTempDir();
    expect(() => resolveRepoRelativePath(repoDir, '/etc/passwd')).toThrow(
      /Invalid repository file path/
    );
    expect(() => resolveRepoRelativePath(repoDir, 'C:\\Windows\\x')).toThrow(
      /Invalid repository file path/
    );
  });

  /**
   * Rejects reads/writes under the `.git` directory.
   */
  it('rejects .git paths', () => {
    const repoDir = createTempDir();
    expect(() => resolveRepoRelativePath(repoDir, '.git/config')).toThrow(
      /Invalid repository file path/
    );
  });

  /**
   * Rejects an in-repo symlink whose realpath escapes the repository.
   */
  it('rejects symlink escapes outside the repository', () => {
    const outsideDir = createTempDir();
    const outsideFile = join(outsideDir, 'secret.txt');
    writeFileSync(outsideFile, 'secret');

    const repoDir = createTempDir();
    const linkPath = join(repoDir, 'escape-link');
    try {
      symlinkSync(outsideFile, linkPath);
    } catch {
      // Some CI environments disallow symlinks; skip when creation fails.
      return;
    }
    if (!existsSync(linkPath)) {
      return;
    }

    expect(() => resolveRepoRelativePath(repoDir, 'escape-link')).toThrow(
      /Invalid repository file path/
    );
  });
});
