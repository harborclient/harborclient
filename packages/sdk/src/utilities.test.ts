import { describe, expect, it } from 'vitest';
import { formatHeaders, formatRelativeTime } from './ui/format.js';
import { methodColorClass, statusColorClass } from './ui/tokens.js';

describe('method and status color helpers', () => {
  it('return host classes', () => {
    expect(methodColorClass('GET')).toBe('hc-method-badge text-method-get');
    expect(statusColorClass(200)).toBe('bg-success');
    expect(statusColorClass(404)).toBe('bg-danger');
  });
});

describe('format helpers', () => {
  it('produce readable output', () => {
    expect(formatHeaders({ Accept: 'application/json' })).toBe('Accept: application/json');
    expect(formatRelativeTime(Date.now() - 10_000)).toMatch(/ago|just now/);
  });
});
