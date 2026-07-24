import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const guardScript = path.join(projectRoot, 'scripts/changelog-merge-guard.sh');

const tempDirs: string[] = [];

/**
 * Creates an isolated git repository for changelog guard scenarios.
 */
function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-changelog-guard-'));
  tempDirs.push(dir);

  execGit(dir, ['init']);
  execGit(dir, ['config', 'user.email', 'test@example.com']);
  execGit(dir, ['config', 'user.name', 'Test User']);
  execGit(dir, ['checkout', '-b', 'main']);

  writeChangelog(dir, '# Changelog\n\n## Unreleased\n');
  execGit(dir, ['add', 'CHANGELOG.md']);
  execGit(dir, ['commit', '-m', 'init']);

  return dir;
}

/**
 * Runs a git command in the given repository.
 */
function execGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Writes CHANGELOG.md in the given repository.
 */
function writeChangelog(cwd: string, contents: string): void {
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), contents, 'utf8');
}

/**
 * Runs the changelog merge guard against an upstream ref.
 */
function runGuard(cwd: string, upstream: string): number {
  const result = spawnSync(
    'bash',
    ['-c', `source "${guardScript}" && changelog_merge_guard_check "${upstream}"`],
    { cwd, encoding: 'utf8' }
  );

  return result.status ?? 1;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('changelog merge guard', () => {
  it('allows pull when only upstream changed the changelog', () => {
    const repo = createTempRepo();
    execGit(repo, ['branch', 'upstream']);
    execGit(repo, ['checkout', 'upstream']);
    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n## 1.0.0\n');
    execGit(repo, ['commit', '-am', 'release']);

    execGit(repo, ['checkout', 'main']);

    expect(runGuard(repo, 'upstream')).toBe(0);
  });

  it('allows pull when only local commits changed the changelog', () => {
    const repo = createTempRepo();
    execGit(repo, ['branch', 'upstream']);

    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n- feat: local only\n');
    execGit(repo, ['commit', '-am', 'add entry']);

    expect(runGuard(repo, 'upstream')).toBe(0);
  });

  it('blocks pull when uncommitted changelog edits overlap upstream release', () => {
    const repo = createTempRepo();
    execGit(repo, ['branch', 'upstream']);
    execGit(repo, ['checkout', 'upstream']);
    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n## 1.0.0\n\n- release entry\n');
    execGit(repo, ['commit', '-am', 'release']);

    execGit(repo, ['checkout', 'main']);
    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n- uncommitted entry\n');

    expect(runGuard(repo, 'upstream')).toBe(1);
  });

  it('blocks pull when committed changelog entries overlap upstream release', () => {
    const repo = createTempRepo();
    execGit(repo, ['branch', 'upstream']);

    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n- feat: committed locally\n');
    execGit(repo, ['commit', '-am', 'add entry']);

    execGit(repo, ['checkout', 'upstream']);
    writeChangelog(repo, '# Changelog\n\n## Unreleased\n\n## 1.0.0\n\n- release entry\n');
    execGit(repo, ['commit', '-am', 'release']);

    execGit(repo, ['checkout', 'main']);

    expect(runGuard(repo, 'upstream')).toBe(1);
  });
});
