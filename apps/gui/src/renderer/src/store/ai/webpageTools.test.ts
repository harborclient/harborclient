import { describe, expect, it } from 'vitest';
import {
  WEBPAGE_DOM_TOOLS,
  WEBPAGE_EVAL_RESULT_MAX_CHARS,
  capWebpageEvalResult,
  formatWebpageTabInfo,
  readOptionalBooleanArg,
  readOptionalNumberArg,
  readOptionalStringArg,
  readRequiredStringArg
} from './webpageTools';

describe('formatWebpageTabInfo', () => {
  it('includes a dom descriptor with follow-up tool names', () => {
    const info = formatWebpageTabInfo({
      tabId: 'tab-1',
      url: 'https://example.com/',
      title: 'Example',
      canGoBack: false,
      canGoForward: true
    });

    expect(info).toEqual({
      tabId: 'tab-1',
      url: 'https://example.com/',
      title: 'Example',
      canGoBack: false,
      canGoForward: true,
      dom: {
        tabId: 'tab-1',
        tools: [...WEBPAGE_DOM_TOOLS]
      }
    });
  });

  it('applies navigation overrides from the guest snapshot', () => {
    const info = formatWebpageTabInfo(
      {
        tabId: 'tab-1',
        url: 'about:blank',
        title: 'New Browser',
        canGoBack: false,
        canGoForward: false
      },
      {
        url: 'https://headzoo.io/',
        title: 'Headzoo',
        canGoBack: true,
        canGoForward: false
      }
    );

    expect(info.url).toBe('https://headzoo.io/');
    expect(info.title).toBe('Headzoo');
    expect(info.canGoBack).toBe(true);
  });
});

describe('capWebpageEvalResult', () => {
  it('returns the parsed result when under the size limit', () => {
    expect(capWebpageEvalResult({ ok: true, n: 1 })).toEqual({ result: { ok: true, n: 1 } });
  });

  it('returns a truncated preview when the JSON is too large', () => {
    const large = 'x'.repeat(WEBPAGE_EVAL_RESULT_MAX_CHARS + 50);
    const capped = capWebpageEvalResult(large, 100);
    expect(capped).toMatchObject({
      resultTruncated: true,
      resultType: 'string',
      resultOriginalLength: expect.any(Number)
    });
    if ('resultPreview' in capped) {
      expect(capped.resultPreview.length).toBe(100);
    }
  });
});

describe('webpage tool arg readers', () => {
  it('reads required and optional string args', () => {
    expect(readRequiredStringArg({ tabId: '  a  ' }, 'tabId')).toBe('a');
    expect(readRequiredStringArg({ tabId: '   ' }, 'tabId')).toBeNull();
    expect(readOptionalStringArg({}, 'url')).toBeUndefined();
    expect(readOptionalStringArg({ url: 'https://x.test' }, 'url')).toBe('https://x.test');
    expect(readOptionalStringArg({ url: 1 }, 'url')).toBeNull();
  });

  it('reads optional boolean and number args', () => {
    expect(readOptionalBooleanArg({}, 'all')).toBeUndefined();
    expect(readOptionalBooleanArg({ all: true }, 'all')).toBe(true);
    expect(readOptionalBooleanArg({ all: 'yes' }, 'all')).toBeNull();
    expect(readOptionalNumberArg({ maxElements: 5 }, 'maxElements')).toBe(5);
    expect(readOptionalNumberArg({ maxElements: Number.NaN }, 'maxElements')).toBeNull();
  });
});
