import { describe, expect, it } from 'vitest';
import { environmentDragId, environmentVariableCount, parseEnvironmentDragId } from './utils';

describe('environmentDragId', () => {
  it('builds a stable sortable id', () => {
    expect(environmentDragId(42)).toBe('environment:42');
  });
});

describe('parseEnvironmentDragId', () => {
  it('parses a valid environment drag id', () => {
    expect(parseEnvironmentDragId('environment:42')).toBe(42);
  });

  it('returns null for invalid drag ids', () => {
    expect(parseEnvironmentDragId('request:42')).toBeNull();
    expect(parseEnvironmentDragId('environment:')).toBeNull();
  });
});

describe('environmentVariableCount', () => {
  it('counts only variables with non-empty keys', () => {
    expect(
      environmentVariableCount([
        { key: 'apiUrl', value: 'https://example.com', defaultValue: '', share: false },
        { key: '', value: 'ignored', defaultValue: '', share: false },
        { key: '   ', value: 'ignored', defaultValue: '', share: false }
      ])
    ).toBe(1);
  });

  it('returns zero when there are no variables', () => {
    expect(environmentVariableCount([])).toBe(0);
  });
});
