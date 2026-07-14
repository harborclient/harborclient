import * as git from 'isomorphic-git';
import fs from 'fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const logVerboseMock = vi.hoisted(() => vi.fn());
const mockHomedir = vi.hoisted(() => vi.fn(() => join(tmpdir(), 'harborclient-mock-home')));

vi.mock('#/main/logger', () => ({
  logVerbose: logVerboseMock
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: mockHomedir
  };
});

import {
  parseGitConfigUserSection,
  readSuggestedGitAuthor,
  resolveGlobalGitConfigPath,
  resolveGlobalGitConfigPaths
} from '#/main/git/gitAuthorSuggestion';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
  delete process.env.GIT_CONFIG_GLOBAL;
  logVerboseMock.mockClear();
});

describe('parseGitConfigUserSection', () => {
  it('parses name and email from the user section', () => {
    const text = `[core]
\trepositoryformatversion = 0
[user]
\tname = Jane Doe
\temail = jane@example.com
`;

    expect(parseGitConfigUserSection(text)).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com'
    });
  });

  it('ignores comments and non-user sections', () => {
    const text = `# comment
[remote "origin"]
\turl = https://example.com/repo.git
[user]
; inline comment
name = Repo User
email = repo@example.com
`;

    expect(parseGitConfigUserSection(text)).toEqual({
      name: 'Repo User',
      email: 'repo@example.com'
    });
  });
});

describe('resolveGlobalGitConfigPath', () => {
  it('uses GIT_CONFIG_GLOBAL when set', () => {
    process.env.GIT_CONFIG_GLOBAL = '/tmp/custom.gitconfig';
    expect(resolveGlobalGitConfigPath()).toBe('/tmp/custom.gitconfig');
  });
});

describe('resolveGlobalGitConfigPaths', () => {
  it('includes primary and XDG global config paths', () => {
    const homePath = mkdtempSync(join(tmpdir(), 'harborclient-global-paths-'));
    cleanups.push(() => rmSync(homePath, { recursive: true, force: true }));
    mockHomedir.mockReturnValue(homePath);

    process.env.GIT_CONFIG_GLOBAL = '/tmp/custom.gitconfig';

    expect(resolveGlobalGitConfigPaths()).toEqual([
      '/tmp/custom.gitconfig',
      join(homePath, '.config', 'git', 'config')
    ]);
  });
});

describe('readSuggestedGitAuthor', () => {
  it('prefers repo-local git config values', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-author-local-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Local User' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'local@example.com' });

    const globalPath = mkdtempSync(join(tmpdir(), 'harborclient-author-global-'));
    cleanups.push(() => rmSync(globalPath, { recursive: true, force: true }));
    writeFileSync(
      join(globalPath, 'config'),
      `[user]\n\tname = Global User\n\temail = global@example.com\n`
    );
    process.env.GIT_CONFIG_GLOBAL = join(globalPath, 'config');

    await expect(readSuggestedGitAuthor(repoPath)).resolves.toEqual({
      name: 'Local User',
      email: 'local@example.com'
    });

    expect(logVerboseMock).toHaveBeenCalledWith(
      'git:author-suggestion',
      expect.objectContaining({
        repoPath,
        nameSource: 'repo-local',
        emailSource: 'repo-local',
        name: 'Local User',
        email: 'local@example.com'
      })
    );
  });

  it('falls back to global git config when repo-local values are missing', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-author-repo-empty-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });

    const globalPath = mkdtempSync(join(tmpdir(), 'harborclient-author-global-only-'));
    cleanups.push(() => rmSync(globalPath, { recursive: true, force: true }));
    const configPath = join(globalPath, 'config');
    writeFileSync(configPath, `[user]\n\tname = Global User\n\temail = global@example.com\n`);
    process.env.GIT_CONFIG_GLOBAL = configPath;

    await expect(readSuggestedGitAuthor(repoPath)).resolves.toEqual({
      name: 'Global User',
      email: 'global@example.com'
    });
  });

  it('returns empty strings when neither repo-local nor global config provide values', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-author-empty-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });

    const missingGlobalPath = join(tmpdir(), 'missing-global-config');
    process.env.GIT_CONFIG_GLOBAL = missingGlobalPath;

    await expect(readSuggestedGitAuthor(repoPath)).resolves.toEqual({
      name: '',
      email: ''
    });

    expect(logVerboseMock).toHaveBeenCalledWith(
      'git:author-suggestion',
      expect.objectContaining({
        repoPath,
        globalConfigPath: missingGlobalPath,
        nameSource: 'missing',
        emailSource: 'missing',
        name: '',
        email: ''
      })
    );
    expect(logVerboseMock).toHaveBeenCalledWith(
      'git:author-suggestion: could not determine commit author from repo-local or global git config'
    );
  });

  it('merges repo-local and global values per field', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-author-merge-'));
    cleanups.push(() => rmSync(repoPath, { recursive: true, force: true }));
    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Local Name' });

    const globalPath = mkdtempSync(join(tmpdir(), 'harborclient-author-merge-global-'));
    cleanups.push(() => rmSync(globalPath, { recursive: true, force: true }));
    const configPath = join(globalPath, 'config');
    writeFileSync(configPath, `[user]\n\temail = global@example.com\n`);
    process.env.GIT_CONFIG_GLOBAL = configPath;

    await expect(readSuggestedGitAuthor(repoPath)).resolves.toEqual({
      name: 'Local Name',
      email: 'global@example.com'
    });
  });

  it('falls back to XDG global config when the primary global file is missing', async () => {
    const homePath = mkdtempSync(join(tmpdir(), 'harborclient-xdg-home-'));
    cleanups.push(() => rmSync(homePath, { recursive: true, force: true }));
    mockHomedir.mockReturnValue(homePath);

    const xdgConfigDir = join(homePath, '.config', 'git');
    mkdirSync(xdgConfigDir, { recursive: true });
    writeFileSync(
      join(xdgConfigDir, 'config'),
      `[user]\n\tname = XDG User\n\temail = xdg@example.com\n`
    );

    process.env.GIT_CONFIG_GLOBAL = join(homePath, 'missing.gitconfig');

    await expect(readSuggestedGitAuthor()).resolves.toEqual({
      name: 'XDG User',
      email: 'xdg@example.com'
    });

    expect(logVerboseMock).toHaveBeenCalledWith(
      'git:author-suggestion',
      expect.objectContaining({
        nameSource: 'global',
        emailSource: 'global',
        nameConfigPath: join(xdgConfigDir, 'config'),
        emailConfigPath: join(xdgConfigDir, 'config')
      })
    );
  });
});
