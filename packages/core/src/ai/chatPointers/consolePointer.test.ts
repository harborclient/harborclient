import { describe, expect, it } from 'vitest';
import { buildConsoleReferenceToken, slugifyConsolePointerSegment } from './consolePointer.js';

describe('slugifyConsolePointerSegment', () => {
  it('slugifies spaced labels', () => {
    expect(slugifyConsolePointerSegment('Request sent')).toBe('request-sent');
    expect(slugifyConsolePointerSegment('Waiting for server response')).toBe(
      'waiting-for-server-response'
    );
    expect(slugifyConsolePointerSegment('Error')).toBe('error');
  });

  it('preserves kebab-case header names', () => {
    expect(slugifyConsolePointerSegment('report-to')).toBe('report-to');
    expect(slugifyConsolePointerSegment('Content-Type')).toBe('content-type');
  });

  it('returns empty for blank labels', () => {
    expect(slugifyConsolePointerSegment('   ')).toBe('');
  });
});

describe('buildConsoleReferenceToken', () => {
  it('builds a selection token', () => {
    expect(buildConsoleReferenceToken('general', 'error', 0, 12)).toBe(
      '@console.general.error#0.12'
    );
    expect(buildConsoleReferenceToken('headers', 'report-to', 1, 12)).toBe(
      '@console.headers.report-to#1.12'
    );
    expect(buildConsoleReferenceToken('timing', 'request-sent', 1, 23)).toBe(
      '@console.timing.request-sent#1.23'
    );
  });
});
