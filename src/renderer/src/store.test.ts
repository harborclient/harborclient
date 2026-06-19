import { describe, expect, it } from 'vitest';
import { resolveVariable, substituteVariables, tokenizeVariables } from '#/renderer/src/store';

const variable = (
  key: string,
  value: string,
  defaultValue = '',
  share = false
): { key: string; value: string; defaultValue: string; share: boolean } => ({
  key,
  value,
  defaultValue,
  share
});

describe('substituteVariables', () => {
  it('replaces known variable tokens', () => {
    const result = substituteVariables('https://{{host}}/api/{{version}}', [
      variable('host', 'api.example.com'),
      variable('version', 'v1')
    ]);

    expect(result).toBe('https://api.example.com/api/v1');
  });

  it('leaves unknown tokens unchanged', () => {
    const result = substituteVariables('https://{{host}}/{{missing}}', [
      variable('host', 'api.example.com')
    ]);

    expect(result).toBe('https://api.example.com/{{missing}}');
  });

  it('handles surrounding whitespace inside braces', () => {
    const result = substituteVariables('https://{{ host }}/users', [
      variable('host', 'api.example.com')
    ]);

    expect(result).toBe('https://api.example.com/users');
  });

  it('trims variable keys when building the lookup', () => {
    const result = substituteVariables('https://{{host}}', [
      variable('  host  ', 'api.example.com')
    ]);

    expect(result).toBe('https://api.example.com');
  });

  it('ignores blank-key variables', () => {
    const result = substituteVariables('https://{{host}}', [
      variable('   ', 'ignored.example.com'),
      variable('host', 'api.example.com')
    ]);

    expect(result).toBe('https://api.example.com');
  });

  it('falls back to defaultValue when value is empty', () => {
    const result = substituteVariables('https://{{host}}/api', [variable('host', '', 'localhost')]);

    expect(result).toBe('https://localhost/api');
  });

  it('prefers value over defaultValue when both are set', () => {
    const result = substituteVariables('https://{{host}}/api', [
      variable('host', 'api.example.com', 'localhost')
    ]);

    expect(result).toBe('https://api.example.com/api');
  });

  it('substitutes variables in collection header values', () => {
    const result = substituteVariables('Bearer {{token}}', [variable('token', 'abc123')]);

    expect(result).toBe('Bearer abc123');
  });
});

describe('tokenizeVariables', () => {
  it('returns a single plain-text token when no variables are present', () => {
    expect(tokenizeVariables('https://api.example.com')).toEqual([
      { text: 'https://api.example.com' }
    ]);
  });

  it('splits text around variable tokens', () => {
    expect(tokenizeVariables('https://{{host}}/api/{{version}}')).toEqual([
      { text: 'https://' },
      { text: '{{host}}', key: 'host' },
      { text: '/api/' },
      { text: '{{version}}', key: 'version' }
    ]);
  });

  it('captures keys with surrounding whitespace inside braces', () => {
    expect(tokenizeVariables('https://{{ host }}/users')).toEqual([
      { text: 'https://' },
      { text: '{{ host }}', key: 'host' },
      { text: '/users' }
    ]);
  });
});

describe('resolveVariable', () => {
  it('returns the resolved value for a known key', () => {
    expect(resolveVariable('host', [variable('host', 'api.example.com')])).toBe('api.example.com');
  });

  it('falls back to defaultValue when value is empty', () => {
    expect(resolveVariable('host', [variable('host', '', 'localhost')])).toBe('localhost');
  });

  it('returns undefined for unknown keys', () => {
    expect(resolveVariable('missing', [variable('host', 'api.example.com')])).toBeUndefined();
  });
});
