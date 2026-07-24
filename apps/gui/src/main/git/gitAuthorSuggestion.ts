import * as git from 'isomorphic-git';
import fs from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logVerbose } from '#/main/logger';

/**
 * Suggested commit author name and email from git configuration.
 */
export interface SuggestedGitAuthor {
  /**
   * Suggested author display name, or empty when unknown.
   */
  name: string;

  /**
   * Suggested author email address, or empty when unknown.
   */
  email: string;
}

/**
 * Where a suggested author field value was resolved from.
 */
export type GitAuthorFieldSource = 'repo-local' | 'global' | 'missing';

/**
 * Resolves the primary global git config file path for the current user.
 *
 * Honors GIT_CONFIG_GLOBAL when set; otherwise uses ~/.gitconfig.
 *
 * @returns Absolute path to the primary global git config file.
 */
export function resolveGlobalGitConfigPath(): string {
  const override = process.env.GIT_CONFIG_GLOBAL?.trim();
  if (override) {
    return override;
  }
  return join(homedir(), '.gitconfig');
}

/**
 * Returns global git config file paths to try, in priority order.
 *
 * @returns Unique absolute paths for primary and XDG global config files.
 */
export function resolveGlobalGitConfigPaths(): string[] {
  const paths = [resolveGlobalGitConfigPath(), join(homedir(), '.config', 'git', 'config')];
  return [...new Set(paths)];
}

/**
 * Parses user.name and user.email from a git config file's [user] section.
 *
 * @param text - Raw git config file contents.
 * @returns Parsed name and email values, which may be empty strings.
 */
export function parseGitConfigUserSection(text: string): SuggestedGitAuthor {
  let inUserSection = false;
  let name = '';
  let email = '';

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      inUserSection = sectionMatch[1]?.trim().toLowerCase() === 'user';
      continue;
    }

    if (!inUserSection) {
      continue;
    }

    const entryMatch = /^([^=]+)=(.*)$/u.exec(line);
    if (!entryMatch) {
      continue;
    }

    const key = entryMatch[1]?.trim().toLowerCase() ?? '';
    const value = entryMatch[2]?.trim() ?? '';
    if (key === 'name' && !name) {
      name = value;
    } else if (key === 'email' && !email) {
      email = value;
    }
  }

  return { name, email };
}

/**
 * Reads one user field from global git config files.
 *
 * @param field - Author field to read from the [user] section.
 * @returns Resolved value and the config file path when found.
 */
async function readGlobalGitUserField(
  field: 'name' | 'email'
): Promise<{ value: string; configPath?: string }> {
  for (const configPath of resolveGlobalGitConfigPaths()) {
    try {
      const text = await fs.promises.readFile(configPath, 'utf8');
      const parsed = parseGitConfigUserSection(text);
      const value = (field === 'name' ? parsed.name : parsed.email).trim();
      if (value) {
        return { value, configPath };
      }
    } catch {
      // Try the next global config path.
    }
  }

  return { value: '' };
}

/**
 * Reads user.name or user.email from a repository's local git config.
 *
 * @param repoPath - Absolute repository root path.
 * @param path - Git config key to read.
 * @returns Trimmed config value, or empty string when missing.
 */
async function readRepoGitConfigValue(
  repoPath: string,
  path: 'user.name' | 'user.email'
): Promise<string> {
  try {
    const value = await git.getConfig({ fs, dir: repoPath, path });
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Suggests commit author name and email from repo-local git config first, then global.
 *
 * Name and email are resolved independently; empty strings are returned for unknown fields.
 *
 * @param repoPath - Optional repository root for repo-local config lookup.
 * @returns Suggested author name and email.
 */
export async function readSuggestedGitAuthor(repoPath?: string): Promise<SuggestedGitAuthor> {
  let name = '';
  let email = '';
  let nameSource: GitAuthorFieldSource = 'missing';
  let emailSource: GitAuthorFieldSource = 'missing';
  let nameConfigPath: string | undefined;
  let emailConfigPath: string | undefined;

  if (repoPath) {
    name = await readRepoGitConfigValue(repoPath, 'user.name');
    if (name) {
      nameSource = 'repo-local';
    }
    email = await readRepoGitConfigValue(repoPath, 'user.email');
    if (email) {
      emailSource = 'repo-local';
    }
  }

  if (!name) {
    const globalName = await readGlobalGitUserField('name');
    name = globalName.value;
    if (name) {
      nameSource = 'global';
      nameConfigPath = globalName.configPath;
    }
  }

  if (!email) {
    const globalEmail = await readGlobalGitUserField('email');
    email = globalEmail.value;
    if (email) {
      emailSource = 'global';
      emailConfigPath = globalEmail.configPath;
    }
  }

  logVerbose('git:author-suggestion', {
    repoPath: repoPath ?? null,
    globalConfigPath: resolveGlobalGitConfigPath(),
    nameSource,
    emailSource,
    nameConfigPath: nameConfigPath ?? null,
    emailConfigPath: emailConfigPath ?? null,
    name,
    email
  });

  if (!name && !email) {
    logVerbose(
      'git:author-suggestion: could not determine commit author from repo-local or global git config'
    );
  }

  return { name, email };
}
