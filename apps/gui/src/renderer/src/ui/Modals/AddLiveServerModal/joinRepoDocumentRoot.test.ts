import { describe, expect, it } from 'vitest';
import { joinRepoDocumentRoot } from './joinRepoDocumentRoot';

describe('joinRepoDocumentRoot', () => {
  it('returns the trimmed repo path when subdirectory is empty', () => {
    expect(joinRepoDocumentRoot('/home/sean/repo/', '  ')).toBe('/home/sean/repo');
  });

  it('joins posix paths with a forward slash', () => {
    expect(joinRepoDocumentRoot('/home/sean/repo', '.harborclient')).toBe(
      '/home/sean/repo/.harborclient'
    );
  });

  it('joins windows-style paths with a backslash', () => {
    expect(joinRepoDocumentRoot('C:\\Users\\sean\\repo\\', 'site')).toBe(
      'C:\\Users\\sean\\repo\\site'
    );
  });
});
