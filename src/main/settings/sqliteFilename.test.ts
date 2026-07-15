import { describe, expect, it } from 'vitest';
import { normalizeSqliteFilename } from './sqliteFilename';

const FALLBACK = 'harborclient.db';

describe('normalizeSqliteFilename', () => {
  it('returns the fallback for blank input', () => {
    expect(normalizeSqliteFilename('', FALLBACK)).toBe(FALLBACK);
    expect(normalizeSqliteFilename('   ', FALLBACK)).toBe(FALLBACK);
  });

  it('keeps a simple filename unchanged', () => {
    expect(normalizeSqliteFilename('harborclient.db', FALLBACK)).toBe('harborclient.db');
  });

  it('strips directory components from relative paths', () => {
    expect(normalizeSqliteFilename('../outside.db', FALLBACK)).toBe('outside.db');
    expect(normalizeSqliteFilename('nested/data.db', FALLBACK)).toBe('data.db');
  });

  it('strips directory components from absolute paths', () => {
    expect(normalizeSqliteFilename('/etc/passwd', FALLBACK)).toBe('passwd');
    expect(normalizeSqliteFilename('/var/lib/harbor/data.db', FALLBACK)).toBe('data.db');
  });

  it('returns the fallback for traversal-only segments', () => {
    expect(normalizeSqliteFilename('.', FALLBACK)).toBe(FALLBACK);
    expect(normalizeSqliteFilename('..', FALLBACK)).toBe(FALLBACK);
    expect(normalizeSqliteFilename('/', FALLBACK)).toBe(FALLBACK);
  });
});
