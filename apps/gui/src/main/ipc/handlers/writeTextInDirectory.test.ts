import { describe, expect, it } from 'vitest';
import { isPathInsideDirectory, resolveWritePathInDirectory } from './writeTextInDirectory';

describe('resolveWritePathInDirectory', () => {
  it('resolves a basename under the directory', () => {
    const result = resolveWritePathInDirectory('/tmp/results', 'workflow-2026-07-28-13-59-07.json');
    expect(result).toBe('/tmp/results/workflow-2026-07-28-13-59-07.json');
  });

  it('rejects directory separators in the file name', () => {
    expect(() => resolveWritePathInDirectory('/tmp/results', '../escape.json')).toThrow(/basename/);
    expect(() => resolveWritePathInDirectory('/tmp/results', 'sub/dir.json')).toThrow(/basename/);
  });

  it('rejects empty directory or file name', () => {
    expect(() => resolveWritePathInDirectory('  ', 'a.json')).toThrow(/Directory/);
    expect(() => resolveWritePathInDirectory('/tmp', '  ')).toThrow(/File name/);
  });
});

describe('isPathInsideDirectory', () => {
  it('accepts nested files and rejects the directory itself or siblings', () => {
    expect(isPathInsideDirectory('/tmp/results', '/tmp/results/a.json')).toBe(true);
    expect(isPathInsideDirectory('/tmp/results', '/tmp/results')).toBe(false);
    expect(isPathInsideDirectory('/tmp/results', '/tmp/other/a.json')).toBe(false);
  });
});
