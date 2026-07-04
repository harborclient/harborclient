import { describe, expect, it } from 'vitest';
import { formatRequestTags, normalizeRequestTags, parseRequestTags } from '#/shared/requestTags';

describe('normalizeRequestTags', () => {
  it('trims segments and joins with comma space', () => {
    expect(normalizeRequestTags(' api , auth , staging ')).toBe('api, auth, staging');
  });

  it('drops empty segments from trailing or duplicate commas', () => {
    expect(normalizeRequestTags('api,, auth,')).toBe('api, auth');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeRequestTags('')).toBe('');
    expect(normalizeRequestTags('   ')).toBe('');
    expect(normalizeRequestTags(', ,')).toBe('');
  });

  it('preserves segment order', () => {
    expect(normalizeRequestTags('z, a, m')).toBe('z, a, m');
  });
});

describe('parseRequestTags', () => {
  it('returns trimmed non-empty segments in order', () => {
    expect(parseRequestTags(' api , auth , staging ')).toEqual(['api', 'auth', 'staging']);
  });

  it('drops empty segments from trailing or duplicate commas', () => {
    expect(parseRequestTags('api,, auth,')).toEqual(['api', 'auth']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseRequestTags('')).toEqual([]);
    expect(parseRequestTags('   ')).toEqual([]);
    expect(parseRequestTags(', ,')).toEqual([]);
  });
});

describe('formatRequestTags', () => {
  it('joins trimmed tags with comma space', () => {
    expect(formatRequestTags(['api', 'auth', 'staging'])).toBe('api, auth, staging');
  });

  it('drops blank entries before joining', () => {
    expect(formatRequestTags(['api', '  ', '', 'auth'])).toBe('api, auth');
  });

  it('returns an empty string for an empty list', () => {
    expect(formatRequestTags([])).toBe('');
  });
});

describe('parseRequestTags and formatRequestTags round trip', () => {
  it('round trips normalized tag strings', () => {
    const normalized = normalizeRequestTags(' api , auth , staging , ');
    expect(formatRequestTags(parseRequestTags(normalized))).toBe(normalized);
  });
});
