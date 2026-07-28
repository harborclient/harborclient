import { describe, expect, it } from 'vitest';
import {
  isNamespaceVariableClearPattern,
  variableClearMatches,
  variableKeyIsCleared
} from './variableClearMatch';

describe('isNamespaceVariableClearPattern', () => {
  it('accepts trailing .* with a non-empty prefix', () => {
    expect(isNamespaceVariableClearPattern('workflow_a.*')).toBe(true);
    expect(isNamespaceVariableClearPattern(' a.b.* ')).toBe(true);
  });

  it('rejects exact keys and bare .*', () => {
    expect(isNamespaceVariableClearPattern('workflow_a')).toBe(false);
    expect(isNamespaceVariableClearPattern('workflow_a.foo')).toBe(false);
    expect(isNamespaceVariableClearPattern('.*')).toBe(false);
    expect(isNamespaceVariableClearPattern('*')).toBe(false);
    expect(isNamespaceVariableClearPattern('')).toBe(false);
  });
});

describe('variableClearMatches', () => {
  it('matches exact keys', () => {
    expect(variableClearMatches('token', 'token')).toBe(true);
    expect(variableClearMatches('token', 'other')).toBe(false);
  });

  it('matches namespace prefixes for .* patterns', () => {
    expect(variableClearMatches('workflow_a.foo', 'workflow_a.*')).toBe(true);
    expect(variableClearMatches('workflow_a.foo.bar', 'workflow_a.*')).toBe(true);
    expect(variableClearMatches('workflow_a', 'workflow_a.*')).toBe(false);
    expect(variableClearMatches('workflow_b.foo', 'workflow_a.*')).toBe(false);
    expect(variableClearMatches('host', 'workflow_a.*')).toBe(false);
  });

  it('supports case-insensitive matching for persisted rows', () => {
    expect(variableClearMatches('Workflow_A.Foo', 'workflow_a.*', { caseInsensitive: true })).toBe(
      true
    );
    expect(variableClearMatches('Token', 'token', { caseInsensitive: true })).toBe(true);
    expect(variableClearMatches('Token', 'token')).toBe(false);
  });
});

describe('variableKeyIsCleared', () => {
  it('returns true when any clear entry matches', () => {
    expect(variableKeyIsCleared('workflow_a.foo', ['host', 'workflow_a.*'])).toBe(true);
    expect(variableKeyIsCleared('host', ['host', 'workflow_a.*'])).toBe(true);
    expect(variableKeyIsCleared('other', ['host', 'workflow_a.*'])).toBe(false);
  });
});
