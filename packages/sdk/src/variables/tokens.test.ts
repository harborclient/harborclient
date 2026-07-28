import { describe, expect, it } from 'vitest';
import type { Variable } from '../types.js';
import {
  getVariableTokenAtOffset,
  getVariableTooltipContent,
  parseVariableTokens,
  resolveVariable,
  substituteVariables,
  tokenizeVariables
} from './tokens.js';

/**
 * Builds a test variable row.
 *
 * @param key - Variable name.
 * @param value - Current value.
 * @param defaultValue - Fallback when value is empty.
 * @param share - Whether the variable is shared on export.
 */
const variable = (key: string, value: string, defaultValue = '', share = false): Variable => ({
  key,
  value,
  defaultValue,
  enabled: true,
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

  it('substitutes {{ host }} when token key has surrounding whitespace', () => {
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

  it('resolves dynamic variables when no static variable is defined', () => {
    const result = substituteVariables('id={{ $guid }}', []);

    expect(result).not.toContain('{{');
    expect(result).toMatch(/^id=[0-9a-f-]{36}$/i);
  });

  it('prefers static variables over dynamic variables with the same key', () => {
    const result = substituteVariables('{{$randomInt}}', [variable('$randomInt', '42')]);

    expect(result).toBe('42');
  });

  it('leaves unknown dynamic-style tokens unchanged', () => {
    const result = substituteVariables('{{$notRegistered}}', []);

    expect(result).toBe('{{$notRegistered}}');
  });

  it('applies a single filter to a resolved variable', () => {
    const result = substituteVariables('{{name|upper}}', [variable('name', 'hello')]);

    expect(result).toBe('HELLO');
  });

  it('chains filters left-to-right', () => {
    const result = substituteVariables('{{name|trim|upper}}', [variable('name', '  hello  ')]);

    expect(result).toBe('HELLO');
  });

  it('leaves the token unchanged when a filter is unknown', () => {
    const result = substituteVariables('{{name|unknown}}', [variable('name', 'hello')]);

    expect(result).toBe('{{name|unknown}}');
  });

  it('url-encodes resolved values', () => {
    const result = substituteVariables('{{q|urlencode}}', [variable('q', 'a b')]);

    expect(result).toBe('a%20b');
  });
});

describe('parseVariableTokens', () => {
  it('parses a bare variable token', () => {
    expect(parseVariableTokens('https://{{host}}/api')).toEqual([
      {
        raw: '{{host}}',
        key: 'host',
        filters: [],
        start: 8,
        end: 16
      }
    ]);
  });

  it('parses variable tokens with chained filters', () => {
    expect(parseVariableTokens('{{ name | trim | upper }}')).toEqual([
      {
        raw: '{{ name | trim | upper }}',
        key: 'name',
        filters: [
          { name: 'trim', args: [] },
          { name: 'upper', args: [] }
        ],
        start: 0,
        end: 25
      }
    ]);
  });

  it('skips malformed tokens without a closing brace', () => {
    expect(parseVariableTokens('{{host')).toEqual([]);
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

  it('tokenizeVariables extracts host key from {{ host }} token', () => {
    expect(tokenizeVariables('https://{{ host }}/users')).toEqual([
      { text: 'https://' },
      { text: '{{ host }}', key: 'host' },
      { text: '/users' }
    ]);
  });

  it('tokenizeVariables recognizes dynamic variable keys with $ prefix', () => {
    expect(tokenizeVariables('{{$randomUUID}}')).toEqual([
      { text: '{{$randomUUID}}', key: '$randomUUID' }
    ]);
  });

  it('includes filter metadata on variable tokens', () => {
    expect(tokenizeVariables('{{name|upper}}')).toEqual([
      {
        text: '{{name|upper}}',
        key: 'name',
        filters: [{ name: 'upper', args: [] }]
      }
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

describe('getVariableTokenAtOffset', () => {
  const text = 'https://{{host}}/api/{{version}}';

  it('returns the token when offset is inside a variable placeholder', () => {
    expect(getVariableTokenAtOffset(text, 10)).toEqual({
      key: 'host',
      start: 8,
      end: 16
    });
  });

  it('returns null when offset is outside any token', () => {
    expect(getVariableTokenAtOffset(text, 0)).toBeNull();
    expect(getVariableTokenAtOffset(text, 7)).toBeNull();
  });

  it('matches at token start and end boundaries', () => {
    expect(getVariableTokenAtOffset('{{host}}', 0)?.key).toBe('host');
    expect(getVariableTokenAtOffset('{{host}}', 8)?.key).toBe('host');
  });

  it('matches tokens with whitespace around the key', () => {
    expect(getVariableTokenAtOffset('https://{{ host }}/users', 10)).toEqual({
      key: 'host',
      start: 8,
      end: 18
    });
  });
});

describe('getVariableTooltipContent', () => {
  it('returns resolved static value without muted styling', () => {
    expect(getVariableTooltipContent('host', [variable('host', 'api.example.com')])).toEqual({
      text: 'api.example.com',
      muted: false
    });
  });

  it('returns dynamic description for registered dynamic variables', () => {
    expect(getVariableTooltipContent('$guid', [])).toEqual({
      text: 'Dynamic: A uuid-v4 style guid',
      muted: true
    });
  });

  it('returns Not defined for unknown keys', () => {
    expect(getVariableTooltipContent('missing', [variable('host', 'api.example.com')])).toEqual({
      text: 'Not defined',
      muted: true
    });
  });
});
