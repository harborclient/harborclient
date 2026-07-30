import { describe, expect, it } from 'vitest';
import { createInlineScriptRef } from '@harborclient/core/scriptRefs';
import {
  areBrowserHcScriptsDirty,
  buildBrowserPageResponseSnapshot,
  buildBrowserScriptRequest,
  BROWSER_PAGE_HTML_MAX_CHARS,
  capBrowserPageHtml,
  normalizeBrowserHcScriptRefs,
  resolveBrowserHcScriptSources
} from './browserHcScripts';

describe('areBrowserHcScriptsDirty', () => {
  it('ignores expanded UI state', () => {
    const saved = [createInlineScriptRef('console.log(1)', 'A', 'main')];
    const draft = saved.map((script) => ({ ...script, expanded: true }));
    expect(areBrowserHcScriptsDirty(draft, saved)).toBe(false);
  });

  it('detects source edits', () => {
    const saved = [createInlineScriptRef('console.log(1)', 'A', 'main')];
    const draft = [createInlineScriptRef('console.log(2)', 'A', 'main')];
    expect(areBrowserHcScriptsDirty(draft, saved)).toBe(true);
  });
});

describe('normalizeBrowserHcScriptRefs', () => {
  it('forces stages to main and drops invalid entries', () => {
    const refs = normalizeBrowserHcScriptRefs([
      createInlineScriptRef('a()', 'A', 'before-each'),
      { id: 'bad' },
      null
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.stage).toBe('main');
  });
});

describe('resolveBrowserHcScriptSources', () => {
  it('skips disabled and blank scripts', () => {
    const enabled = createInlineScriptRef('ok()', 'Ok', 'main');
    const disabled = { ...createInlineScriptRef('no()', 'No', 'main'), enabled: false };
    const blank = createInlineScriptRef('   ', 'Blank', 'main');
    expect(resolveBrowserHcScriptSources([enabled, disabled, blank], [])).toEqual([
      { id: enabled.id, name: 'Ok', source: 'ok()' }
    ]);
  });
});

describe('buildBrowserScriptRequest', () => {
  it('seeds a GET request context from the navigation URL', () => {
    expect(buildBrowserScriptRequest('https://example.com/path')).toEqual({
      method: 'GET',
      url: 'https://example.com/path',
      headers: [],
      userAgent: '',
      params: [],
      body: '',
      bodyType: 'none',
      tags: '',
      comment: ''
    });
  });
});

describe('buildBrowserPageResponseSnapshot', () => {
  it('exposes html body with content-type and status', () => {
    const result = buildBrowserPageResponseSnapshot({
      url: 'https://example.com/',
      title: 'Example',
      statusCode: 201,
      html: '<html></html>'
    });
    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Example');
    expect(result.headers['content-type']).toBe('text/html');
    expect(result.body).toBe('<html></html>');
    expect(result.request?.url).toBe('https://example.com/');
  });

  it('caps oversized html', () => {
    const html = 'x'.repeat(BROWSER_PAGE_HTML_MAX_CHARS + 10);
    expect(capBrowserPageHtml(html)).toHaveLength(BROWSER_PAGE_HTML_MAX_CHARS);
    const result = buildBrowserPageResponseSnapshot({
      url: 'https://example.com/',
      title: '',
      html
    });
    expect(result.body).toHaveLength(BROWSER_PAGE_HTML_MAX_CHARS);
    expect(result.status).toBe(200);
  });
});
