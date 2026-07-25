import { describe, expect, it } from 'vitest';
import { normalizeHostDiagnostics } from './hostDiagnostics.js';

describe('normalizeHostDiagnostics', () => {
  it('clamps offsets into the document', () => {
    expect(normalizeHostDiagnostics(10, [{ from: -5, to: 20, message: 'out of range' }])).toEqual([
      {
        from: 0,
        to: 10,
        severity: 'error',
        message: 'out of range'
      }
    ]);
  });

  it('drops entries with an empty or whitespace-only message', () => {
    expect(
      normalizeHostDiagnostics(10, [
        { from: 0, to: 3, message: '' },
        { from: 1, to: 4, message: '   ' },
        { from: 2, to: 5, message: 'keep' }
      ])
    ).toEqual([
      {
        from: 2,
        to: 5,
        severity: 'error',
        message: 'keep'
      }
    ]);
  });

  it('drops inverted ranges after clamping', () => {
    expect(normalizeHostDiagnostics(10, [{ from: 8, to: 3, message: 'inverted' }])).toEqual([]);
  });

  it('preserves severity and source when provided', () => {
    expect(
      normalizeHostDiagnostics(10, [
        {
          from: 1,
          to: 4,
          message: 'warn',
          severity: 'warning',
          source: 'test'
        }
      ])
    ).toEqual([
      {
        from: 1,
        to: 4,
        severity: 'warning',
        message: 'warn',
        source: 'test'
      }
    ]);
  });

  it('preserves diagnostic actions when provided', () => {
    const apply = (): void => {};
    expect(
      normalizeHostDiagnostics(10, [
        {
          from: 1,
          to: 4,
          message: 'fail',
          actions: [{ name: 'Copy to chat (Ctrl+Shift+O)', apply }]
        }
      ])
    ).toEqual([
      {
        from: 1,
        to: 4,
        severity: 'error',
        message: 'fail',
        actions: [{ name: 'Copy to chat (Ctrl+Shift+O)', apply }]
      }
    ]);
  });

  it('allows zero-width markers at a clamped offset', () => {
    expect(normalizeHostDiagnostics(10, [{ from: 5, to: 5, message: 'caret' }])).toEqual([
      {
        from: 5,
        to: 5,
        severity: 'error',
        message: 'caret'
      }
    ]);
  });
});
