import { describe, expect, it } from 'vitest';
import type { AuthConfig } from '../types.js';
import { resolveAuthVariables, substituteKeyValueRows, substituteVariables } from './substitute.js';

describe('substituteVariables', () => {
  it('replaces known placeholders', () => {
    expect(substituteVariables('{{host}}/api', { host: 'https://example.com' })).toBe(
      'https://example.com/api'
    );
  });

  it('allows whitespace inside braces', () => {
    expect(substituteVariables('{{ host }}/api', { host: 'https://example.com' })).toBe(
      'https://example.com/api'
    );
  });

  it('supports dotted and hyphenated keys', () => {
    expect(
      substituteVariables('{{api.base}}-{{api-key}}', {
        'api.base': 'https://example.com',
        'api-key': 'secret'
      })
    ).toBe('https://example.com-secret');
  });

  it('replaces multiple placeholders in one string', () => {
    expect(
      substituteVariables('{{scheme}}://{{host}}/{{path}}', {
        scheme: 'https',
        host: 'example.com',
        path: 'users'
      })
    ).toBe('https://example.com/users');
  });

  it('leaves unknown placeholders unchanged', () => {
    expect(substituteVariables('{{missing}}/api', { host: 'https://example.com' })).toBe(
      '{{missing}}/api'
    );
  });

  it('replaces with empty string when variable is defined as empty', () => {
    expect(substituteVariables('prefix{{token}}suffix', { token: '' })).toBe('prefixsuffix');
  });

  it('returns text unchanged when there are no placeholders', () => {
    expect(substituteVariables('plain text', { host: 'https://example.com' })).toBe('plain text');
  });

  it('resolves dynamic variables when not in the runtime map', () => {
    const result = substituteVariables('prefix{{$timestamp}}suffix', {});
    expect(result).not.toContain('{{');
    expect(result).toMatch(/^prefix\d+suffix$/);
  });

  it('prefers runtime variables over dynamic variables', () => {
    expect(substituteVariables('{{$timestamp}}', { $timestamp: 'fixed' })).toBe('fixed');
  });

  it('applies filters to runtime variable values', () => {
    expect(substituteVariables('{{name|upper}}', { name: 'hello' })).toBe('HELLO');
  });

  it('leaves tokens unchanged when a filter is unknown', () => {
    expect(substituteVariables('{{name|unknown}}', { name: 'hello' })).toBe('{{name|unknown}}');
  });
});

describe('resolveAuthVariables', () => {
  const auth: AuthConfig = {
    type: 'basic',
    basic: {
      username: '{{user}}',
      password: '{{pass}}'
    },
    bearer: {
      token: '{{token}}'
    }
  };

  it('substitutes basic and bearer credential fields', () => {
    const substitute = (text: string) =>
      text.replace('{{user}}', 'alice').replace('{{pass}}', 'secret').replace('{{token}}', 'tok');

    expect(resolveAuthVariables(auth, substitute)).toEqual({
      type: 'basic',
      basic: {
        username: 'alice',
        password: 'secret'
      },
      bearer: {
        token: 'tok'
      }
    });
  });

  it('preserves auth type and structure', () => {
    const substitute = (text: string) => text;

    const resolved = resolveAuthVariables(auth, substitute);
    expect(resolved.type).toBe('basic');
    expect(resolved.basic).toEqual(auth.basic);
    expect(resolved.bearer).toEqual(auth.bearer);
  });
});

describe('substituteKeyValueRows', () => {
  it('substitutes values while preserving row metadata', () => {
    const rows = [
      { key: 'Accept', value: '{{accept}}', enabled: true },
      { key: 'X-Api-Key', value: 'static', enabled: false }
    ];

    expect(substituteKeyValueRows(rows, { accept: 'application/json' })).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Api-Key', value: 'static', enabled: false }
    ]);
  });

  it('leaves unknown placeholders in row values', () => {
    const rows = [{ key: 'Host', value: '{{host}}', enabled: true }];

    expect(substituteKeyValueRows(rows, {})).toEqual([
      { key: 'Host', value: '{{host}}', enabled: true }
    ]);
  });

  it('returns an empty array for no rows', () => {
    expect(substituteKeyValueRows([], { host: 'example.com' })).toEqual([]);
  });
});
