import { describe, expect, it } from 'vitest';
import { headersIndicateSse, isEventStreamMediaType } from './detectSse';

describe('isEventStreamMediaType', () => {
  it('matches text/event-stream case-insensitively', () => {
    expect(isEventStreamMediaType('text/event-stream')).toBe(true);
    expect(isEventStreamMediaType('TEXT/EVENT-STREAM')).toBe(true);
    expect(isEventStreamMediaType('  text/event-stream; charset=utf-8  ')).toBe(true);
  });

  it('matches when event-stream appears in a multi-value Accept list', () => {
    expect(isEventStreamMediaType('text/event-stream, application/json')).toBe(true);
  });

  it('rejects unrelated media types', () => {
    expect(isEventStreamMediaType('application/json')).toBe(false);
    expect(isEventStreamMediaType('text/plain')).toBe(false);
    expect(isEventStreamMediaType('')).toBe(false);
  });
});

describe('headersIndicateSse', () => {
  it('returns true for an enabled Accept event-stream header', () => {
    expect(
      headersIndicateSse([
        { key: 'Accept', value: 'text/event-stream', enabled: true },
        { key: 'Authorization', value: 'Bearer x', enabled: true }
      ])
    ).toBe(true);
  });

  it('ignores disabled Accept headers and non-Accept keys', () => {
    expect(
      headersIndicateSse([
        { key: 'Accept', value: 'text/event-stream', enabled: false },
        { key: 'Content-Type', value: 'text/event-stream', enabled: true }
      ])
    ).toBe(false);
  });

  it('returns false for ordinary JSON Accept headers', () => {
    expect(headersIndicateSse([{ key: 'Accept', value: 'application/json', enabled: true }])).toBe(
      false
    );
  });
});
