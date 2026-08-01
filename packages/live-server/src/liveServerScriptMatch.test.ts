import { describe, expect, it } from 'vitest';
import { liveServerPathBasename, pathMatchesLiveServerScript } from './liveServerScriptMatch';

describe('liveServerPathBasename', () => {
  it('returns the last path segment', () => {
    expect(liveServerPathBasename('/docs/index.html')).toBe('index.html');
    expect(liveServerPathBasename('/img/logo.png')).toBe('logo.png');
    expect(liveServerPathBasename('/index.html')).toBe('index.html');
  });

  it('returns empty for root', () => {
    expect(liveServerPathBasename('/')).toBe('');
    expect(liveServerPathBasename('')).toBe('');
  });
});

describe('pathMatchesLiveServerScript', () => {
  it('matches every path when pattern is *', () => {
    expect(pathMatchesLiveServerScript('/index.html', '*')).toBe(true);
    expect(pathMatchesLiveServerScript('/api/users', '*')).toBe(true);
    expect(pathMatchesLiveServerScript('/', '*')).toBe(true);
  });

  it('matches basename patterns without a slash', () => {
    expect(pathMatchesLiveServerScript('/index.html', 'index.html')).toBe(true);
    expect(pathMatchesLiveServerScript('/docs/index.html', 'index.html')).toBe(true);
    expect(pathMatchesLiveServerScript('/img/logo.png', '*.png')).toBe(true);
    expect(pathMatchesLiveServerScript('/img/logo.jpg', '*.png')).toBe(false);
    expect(pathMatchesLiveServerScript('/docs/readme.md', 'index.html')).toBe(false);
  });

  it('matches full-path patterns that contain a slash', () => {
    expect(pathMatchesLiveServerScript('/index.html', '/index.html')).toBe(true);
    expect(pathMatchesLiveServerScript('/docs/index.html', '/index.html')).toBe(false);
    expect(pathMatchesLiveServerScript('/api/users', '/api/*')).toBe(true);
    expect(pathMatchesLiveServerScript('/api/users/1', '/api/*')).toBe(false);
    expect(pathMatchesLiveServerScript('/api/users/1', '/api/**')).toBe(true);
  });

  it('treats a leading slash on path patterns as optional for patterns that already include /', () => {
    expect(pathMatchesLiveServerScript('/api/v1', 'api/v1')).toBe(true);
    expect(pathMatchesLiveServerScript('/api/v1', '/api/v1')).toBe(true);
  });

  it('returns false for blank patterns', () => {
    expect(pathMatchesLiveServerScript('/index.html', '')).toBe(false);
    expect(pathMatchesLiveServerScript('/index.html', '   ')).toBe(false);
  });
});
