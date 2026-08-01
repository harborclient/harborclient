import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  matchesLogText,
  type LogMatchOptions
} from './logMatchOptions';

/**
 * Convenience wrapper for matcher options in tests.
 *
 * @param overrides - Fields to replace on the defaults.
 * @returns Complete match options.
 */
function options(overrides: Partial<LogMatchOptions> = {}): LogMatchOptions {
  return { ...DEFAULT_LOG_MATCH_OPTIONS, ...overrides };
}

describe('matchesLogText', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(matchesLogText('GET /index.html 200', '')).toBe(true);
    expect(matchesLogText('GET /index.html 200', '   ')).toBe(true);
  });

  it('matches case-insensitively by default', () => {
    expect(matchesLogText('GET /index.html 200', 'get')).toBe(true);
    expect(matchesLogText('GET /index.html 200', '/INDEX.HTML')).toBe(true);
    expect(matchesLogText('GET /index.html 200', 'post')).toBe(false);
  });

  it('respects match case', () => {
    expect(matchesLogText('GET /index.html', 'GET', options({ matchCase: true }))).toBe(true);
    expect(matchesLogText('GET /index.html', 'get', options({ matchCase: true }))).toBe(false);
  });

  it('matches whole words only when enabled', () => {
    expect(
      matchesLogText('listening on port 3000', 'listen', options({ matchWholeWord: true }))
    ).toBe(false);
    expect(
      matchesLogText('listening on port 3000', 'listening', options({ matchWholeWord: true }))
    ).toBe(true);
  });

  it('matches regex patterns when enabled', () => {
    expect(
      matchesLogText('/api/v1/users', String.raw`/api/v\d+/users`, options({ useRegex: true }))
    ).toBe(true);
    expect(
      matchesLogText('/api/v1/users', String.raw`/api/v\d+/posts`, options({ useRegex: true }))
    ).toBe(false);
  });

  it('combines regex with match case and whole word', () => {
    expect(
      matchesLogText('Hello world', 'Hello', options({ useRegex: true, matchCase: true }))
    ).toBe(true);
    expect(
      matchesLogText('Hello world', 'hello', options({ useRegex: true, matchCase: true }))
    ).toBe(false);
    expect(
      matchesLogText('Hello world', 'Hello', options({ useRegex: true, matchWholeWord: true }))
    ).toBe(true);
    expect(
      matchesLogText('Hello world', 'Hell', options({ useRegex: true, matchWholeWord: true }))
    ).toBe(false);
  });

  it('matches nothing when the regex is invalid', () => {
    expect(matchesLogText('GET /index.html', '[', options({ useRegex: true }))).toBe(false);
  });
});

describe('isLogFilterQueryValid', () => {
  it('treats empty and literal queries as valid', () => {
    expect(isLogFilterQueryValid('', options({ useRegex: true }))).toBe(true);
    expect(isLogFilterQueryValid('[', options())).toBe(true);
  });

  it('reports invalid regex patterns', () => {
    expect(isLogFilterQueryValid('[', options({ useRegex: true }))).toBe(false);
    expect(isLogFilterQueryValid('GET', options({ useRegex: true }))).toBe(true);
  });
});
