import { describe, expect, it } from 'vitest';
import {
  buildInviteJoinUrl,
  normalizeInviteBaseUrl,
  parseInviteBaseUrl,
  resolveInviteBaseUrl
} from '#/cli/invitationJoinUrl.js';

describe('normalizeInviteBaseUrl', () => {
  it('trims whitespace and strips trailing slashes', () => {
    expect(normalizeInviteBaseUrl('  https://hub.example.com/  ')).toBe('https://hub.example.com');
  });
});

describe('parseInviteBaseUrl', () => {
  it('accepts http and https URLs', () => {
    expect(parseInviteBaseUrl('http://127.0.0.1:8787/')).toBe('http://127.0.0.1:8787');
    expect(parseInviteBaseUrl('https://teamhub.example.com')).toBe('https://teamhub.example.com');
  });

  it('rejects empty and non-http(s) values', () => {
    expect(() => parseInviteBaseUrl('')).toThrow('Base URL must not be empty.');
    expect(() => parseInviteBaseUrl('ftp://hub.example.com')).toThrow(
      'Base URL must be a valid http:// or https:// URL.'
    );
    expect(() => parseInviteBaseUrl('not-a-url')).toThrow(
      'Base URL must be a valid http:// or https:// URL.'
    );
  });
});

describe('resolveInviteBaseUrl', () => {
  it('maps wildcard bind hosts to localhost', () => {
    expect(resolveInviteBaseUrl('0.0.0.0', 8787)).toBe('http://127.0.0.1:8787');
    expect(resolveInviteBaseUrl('::', 8787)).toBe('http://127.0.0.1:8787');
  });

  it('preserves concrete bind hosts', () => {
    expect(resolveInviteBaseUrl('127.0.0.1', 8787)).toBe('http://127.0.0.1:8787');
    expect(resolveInviteBaseUrl('teamhub.internal', 8080)).toBe('http://teamhub.internal:8080');
  });

  it('brackets IPv6 display hosts', () => {
    expect(resolveInviteBaseUrl('2001:db8::1', 8787)).toBe('http://[2001:db8::1]:8787');
  });

  it('prefers an explicit --base-url override', () => {
    expect(resolveInviteBaseUrl('0.0.0.0', 8787, 'https://teamhub.example.com/')).toBe(
      'https://teamhub.example.com'
    );
  });
});

describe('buildInviteJoinUrl', () => {
  it('builds an HTTPS join URL with query metadata and #code fragment', () => {
    const url = buildInviteJoinUrl({
      baseUrl: 'https://teamhub.example.com/',
      code: 'hbi_kzK5eXHY-Waw9FCPWN_rFS0j1vgibJZ1XR3DgkiBUmw',
      name: 'Joe',
      role: 'admin',
      expiresAt: '2026-08-08T16:10:51.892Z'
    });

    expect(url.startsWith('https://teamhub.example.com/join?')).toBe(true);
    expect(url).toContain('url=https%3A%2F%2Fteamhub.example.com');
    expect(url).toContain('name=Joe');
    expect(url).toContain('role=admin');
    expect(url).toContain('exp=2026-08-08T16%3A10%3A51.892Z');
    expect(url).toContain('#code=hbi_kzK5eXHY-Waw9FCPWN_rFS0j1vgibJZ1XR3DgkiBUmw');
  });
});
