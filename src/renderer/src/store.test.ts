import { describe, expect, it } from 'vitest';
import { substituteVariables } from '#/renderer/src/store';

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
});
