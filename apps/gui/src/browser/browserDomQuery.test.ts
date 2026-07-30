import { describe, expect, it } from 'vitest';
import {
  BROWSER_DOM_QUERY_DEFAULT_ELEMENTS,
  BROWSER_DOM_QUERY_MAX_ELEMENTS,
  BROWSER_DOM_QUERY_MAX_HTML,
  BROWSER_DOM_QUERY_MAX_TEXT,
  buildBrowserDomQueryScript
} from './browserDomQuery';

describe('buildBrowserDomQueryScript', () => {
  it('embeds the selector as JSON and defaults to a single match', () => {
    const script = buildBrowserDomQueryScript({ selector: 'h1.title' });
    expect(script).toContain(JSON.stringify('h1.title'));
    expect(script).toContain('const all = false');
    expect(script).toContain(`const maxElements = ${BROWSER_DOM_QUERY_DEFAULT_ELEMENTS}`);
    expect(script).toContain(`const maxText = ${BROWSER_DOM_QUERY_MAX_TEXT}`);
    expect(script).toContain(`const maxHtml = ${BROWSER_DOM_QUERY_MAX_HTML}`);
  });

  it('clamps maxElements and enables all matches when requested', () => {
    const script = buildBrowserDomQueryScript({
      selector: 'a',
      all: true,
      maxElements: 999
    });
    expect(script).toContain('const all = true');
    expect(script).toContain(`const maxElements = ${BROWSER_DOM_QUERY_MAX_ELEMENTS}`);
  });

  it('escapes quotes in selectors via JSON encoding', () => {
    const script = buildBrowserDomQueryScript({ selector: `a[href="x"]` });
    expect(script).toContain(JSON.stringify(`a[href="x"]`));
  });
});
