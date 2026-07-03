import { describe, expect, it } from 'vitest';
import { normalizeRequestTags } from '#/shared/requestTags';

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
