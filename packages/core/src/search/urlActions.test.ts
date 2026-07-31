import { describe, expect, it } from 'vitest';
import {
  isActionMenuUrlQuery,
  matchUrlActionSuggestions,
  URL_ACTION_IDS,
  urlPathExtension
} from './urlActions';

describe('isActionMenuUrlQuery', () => {
  it('returns true for absolute http(s) URLs', () => {
    expect(isActionMenuUrlQuery('https://example.com/path')).toBe(true);
    expect(isActionMenuUrlQuery('  http://localhost:3000/a.json  ')).toBe(true);
  });

  it('returns false for non-URL and non-http queries', () => {
    expect(isActionMenuUrlQuery('settings')).toBe(false);
    expect(isActionMenuUrlQuery('#import')).toBe(false);
    expect(isActionMenuUrlQuery('/ask what')).toBe(false);
    expect(isActionMenuUrlQuery('ftp://example.com/file.json')).toBe(false);
    expect(isActionMenuUrlQuery('example.com/file.json')).toBe(false);
  });
});

describe('urlPathExtension', () => {
  it('reads the extension from the pathname, ignoring query and hash', () => {
    expect(urlPathExtension('https://cdn.example.com/a/b/logo.PNG?x=1#y')).toBe('png');
    expect(urlPathExtension('https://app.example.com/assets/postman.json')).toBe('json');
  });

  it('returns null when the path has no file extension', () => {
    expect(urlPathExtension('https://example.com/')).toBe(null);
    expect(urlPathExtension('https://example.com/docs')).toBe(null);
  });
});

describe('matchUrlActionSuggestions', () => {
  it('returns null for non-URL queries', () => {
    expect(matchUrlActionSuggestions('Image: Logo')).toBe(null);
  });

  it('offers Image: Open and Live Page: Open for image URLs', () => {
    const match = matchUrlActionSuggestions('https://harborclient.com/images/logo.png');
    expect(match?.denied).toBe(false);
    expect(match?.actions.map((action) => action.id)).toEqual([
      URL_ACTION_IDS.imageOpen,
      URL_ACTION_IDS.livePageOpen
    ]);
    expect(match?.actions[0]).toMatchObject({ group: 'Image', label: 'Open' });
  });

  it('offers Import: Open and Live Page: Open for .json URLs', () => {
    const match = matchUrlActionSuggestions('https://app.addtowallet.io/assets/postman.json');
    expect(match?.denied).toBe(false);
    expect(match?.actions.map((action) => action.id)).toEqual([
      URL_ACTION_IDS.importOpen,
      URL_ACTION_IDS.livePageOpen
    ]);
    expect(match?.actions[0]).toMatchObject({ group: 'Import', label: 'Open' });
  });

  it('offers only Live Page: Open for ordinary page URLs', () => {
    const match = matchUrlActionSuggestions('https://harborclient.com/getting-started');
    expect(match?.denied).toBe(false);
    expect(match?.actions).toEqual([
      expect.objectContaining({
        id: URL_ACTION_IDS.livePageOpen,
        group: 'Live Page',
        label: 'Open'
      })
    ]);
  });

  it('denies executable and script URLs', () => {
    for (const url of [
      'https://evil.example/payload.js',
      'https://evil.example/setup.exe',
      'https://evil.example/tool.com',
      'https://evil.example/run.sh',
      'https://evil.example/install.msi'
    ]) {
      const match = matchUrlActionSuggestions(url);
      expect(match).toEqual({
        url: new URL(url).toString(),
        actions: [],
        denied: true
      });
    }
  });
});
