import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  collectionDirName,
  countConflictFiles,
  exportFileBaseName,
  pullMergeConflictMessage,
  toFileSlug
} from './slug';

describe('git slug helpers', () => {
  it('normalizes display names into filesystem slugs', () => {
    expect(toFileSlug('  My API Collection!  ')).toBe('my-api-collection');
    expect(toFileSlug('---')).toBe('untitled');
  });

  it('builds kind-prefixed export base names', () => {
    expect(exportFileBaseName('collection', 'Users API')).toBe('collection-users-api');
    expect(exportFileBaseName('environment', 'Prod')).toBe('environment-prod');
    expect(exportFileBaseName('snippet', 'Auth helper')).toBe('snippet-auth-helper');
    expect(collectionDirName('Collection 2')).toBe('collection-collection-2');
  });

  it('counts json files containing merge conflict markers', async () => {
    const root = mkdtempSync(join(tmpdir(), 'hc-git-conflicts-'));
    const nested = join(root, 'collections', 'api');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'clean.json'), '{"name":"ok"}', 'utf-8');
    writeFileSync(
      join(nested, 'conflict.json'),
      '<<<<<<< HEAD\n{"name":"ours"}\n=======\n{"name":"theirs"}\n>>>>>>> branch',
      'utf-8'
    );

    expect(
      await countConflictFiles([join(nested, 'clean.json'), join(nested, 'conflict.json')])
    ).toBe(1);
    expect(existsSync(root)).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });

  it('builds singular and plural pull merge conflict messages', () => {
    expect(pullMergeConflictMessage(1)).toContain('1 file has merge conflicts');
    expect(pullMergeConflictMessage(2)).toContain('2 files have merge conflicts');
    expect(pullMergeConflictMessage(1)).toContain('<<<<<<< conflict markers');
  });
});
