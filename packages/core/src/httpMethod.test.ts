import { describe, expect, it } from 'vitest';
import { parseHttpMethod } from './httpMethod';

describe('parseHttpMethod', () => {
  it('accepts supported methods with normalization', () => {
    expect(parseHttpMethod('get')).toBe('GET');
    expect(parseHttpMethod(' Post ')).toBe('POST');
    expect(parseHttpMethod('OPTIONS')).toBe('OPTIONS');
  });

  it('returns null for unsupported or invalid values', () => {
    expect(parseHttpMethod('TRACE')).toBeNull();
    expect(parseHttpMethod('')).toBeNull();
    expect(parseHttpMethod('   ')).toBeNull();
    expect(parseHttpMethod(null)).toBeNull();
    expect(parseHttpMethod(undefined)).toBeNull();
  });
});
