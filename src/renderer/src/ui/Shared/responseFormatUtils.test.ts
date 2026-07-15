import { describe, expect, it } from 'vitest';
import type { SendResult } from '#/shared/types';
import {
  buildHtmlPreviewSrcdoc,
  buildResponseExport,
  defaultResponseTab,
  isHtmlResponse,
  isImageResponse,
  resolveHtmlPreviewBaseUrl
} from '#/renderer/src/ui/Shared/responseFormatUtils';

const sampleResponse = (overrides: Partial<SendResult> = {}): SendResult => ({
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"foo":"bar"}',
  timeMs: 333,
  sizeBytes: 124554,
  ...overrides
});

describe('buildResponseExport', () => {
  it('maps sent request metadata to method, url, and header key/value pairs', () => {
    const payload = buildResponseExport(
      sampleResponse({
        request: {
          method: 'GET',
          url: 'https://echo.harborclient.com/get',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: '',
          bodyType: 'none'
        }
      }),
      [],
      [],
      []
    );

    expect(payload.request).toEqual({
      method: 'GET',
      url: 'https://echo.harborclient.com/get',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' }
      ]
    });
  });

  it('falls back to requestUrl when sent-request metadata is absent', () => {
    const payload = buildResponseExport(
      sampleResponse(),
      [],
      [],
      [],
      undefined,
      'https://echo.harborclient.com/get'
    );

    expect(payload.request).toEqual({
      method: 'GET',
      url: 'https://echo.harborclient.com/get',
      headers: []
    });
  });

  it('parses JSON bodies and preserves headers and export metadata', () => {
    const payload = buildResponseExport(
      sampleResponse({
        headers: { 'content-type': 'application/json', connection: 'keep-alive' }
      }),
      [],
      [],
      []
    );

    expect(payload.harborclientVersion).toBe(1);
    expect(payload.harborclientExport).toBe('response');
    expect(payload.body).toEqual({ foo: 'bar' });
    expect(payload.headers).toEqual({
      'content-type': 'application/json',
      connection: 'keep-alive'
    });
  });

  it('uses raw string for non-JSON bodies and null for empty bodies', () => {
    expect(buildResponseExport(sampleResponse({ body: 'plain text' }), [], [], []).body).toBe(
      'plain text'
    );
    expect(buildResponseExport(sampleResponse({ body: '' }), [], [], []).body).toBeNull();
  });

  it('includes full timing values when present', () => {
    const payload = buildResponseExport(
      sampleResponse({
        timeMs: 333,
        sizeBytes: 124554,
        timing: {
          stalledMs: 1,
          connectMs: 2,
          requestSentMs: 3,
          waitingMs: 300,
          downloadMs: 27
        }
      }),
      [],
      [],
      []
    );

    expect(payload.timing).toEqual({
      totalTime: 333,
      size: 124554,
      stalledMs: 1,
      connectMs: 2,
      requestSentMs: 3,
      waitingMs: 300,
      downloadMs: 27
    });
  });

  it('omits undefined timing phases from the export', () => {
    expect(
      buildResponseExport(sampleResponse({ timing: { waitingMs: 50 } }), [], [], []).timing
    ).toEqual({
      totalTime: 333,
      size: 124554,
      waitingMs: 50
    });
  });

  it('assembles console output, formatted traces, and script errors', () => {
    const payload = buildResponseExport(
      sampleResponse(),
      [],
      ['Hello world', 'second line'],
      [
        {
          type: 'variable',
          scope: 'request',
          action: 'set',
          key: 'token',
          value: 'abc',
          scriptName: 'Request post-request script 1'
        },
        {
          type: 'flow',
          action: 'set-next-request',
          nextRequest: 'Login',
          scriptName: 'Request post-request script 2'
        }
      ],
      'TypeError: boom'
    );

    expect(payload.console).toEqual({
      output: 'Hello world\nsecond line',
      traces: [
        '[Request post-request script 1] Set Request variable - token = abc',
        '[Request post-request script 2] Set next request - Login'
      ],
      error: 'TypeError: boom'
    });
  });

  it('omits console.error when no script error is present', () => {
    expect(buildResponseExport(sampleResponse(), [], [], []).console).toEqual({
      output: '',
      traces: []
    });
    expect(buildResponseExport(sampleResponse(), [], [], []).console.error).toBeUndefined();
  });

  it('maps test results to label, success, and output with failure suffix', () => {
    const payload = buildResponseExport(
      sampleResponse(),
      [
        {
          name: 'status is 200',
          passed: true,
          scriptName: 'Request post-request script 1'
        },
        {
          name: 'has token',
          passed: false,
          error: 'missing field'
        }
      ],
      [],
      []
    );

    expect(payload.tests).toEqual([
      {
        label: 'Request post-request script 1',
        success: true,
        output: 'status is 200'
      },
      {
        label: 'Script',
        success: false,
        output: 'has token — missing field'
      }
    ]);
  });
});

describe('isHtmlResponse', () => {
  it('returns true for text/html content-type', () => {
    expect(isHtmlResponse('<p>hi</p>', { 'content-type': 'text/html; charset=utf-8' })).toBe(true);
  });

  it('returns true for application/xhtml+xml content-type', () => {
    expect(isHtmlResponse('<html></html>', { 'content-type': 'application/xhtml+xml' })).toBe(true);
  });

  it('detects mislabeled HTML with text/plain content-type', () => {
    expect(isHtmlResponse('<div>Hello</div>', { 'content-type': 'text/plain' })).toBe(true);
  });

  it('returns false for valid JSON bodies', () => {
    expect(isHtmlResponse('{"a":1}', { 'content-type': 'text/html' })).toBe(false);
  });

  it('returns false for empty bodies', () => {
    expect(isHtmlResponse('', { 'content-type': 'text/html' })).toBe(false);
    expect(isHtmlResponse('   ')).toBe(false);
  });

  it('returns false for non-html content with plain text', () => {
    expect(isHtmlResponse('hello world', { 'content-type': 'application/json' })).toBe(false);
  });
});

describe('isImageResponse', () => {
  it('returns true for image/png content-type', () => {
    expect(isImageResponse({ 'content-type': 'image/png' })).toBe(true);
  });

  it('returns true for image/jpeg with charset parameter', () => {
    expect(isImageResponse({ 'Content-Type': 'image/jpeg; charset=binary' })).toBe(true);
  });

  it('returns false for text/html content-type', () => {
    expect(isImageResponse({ 'content-type': 'text/html' })).toBe(false);
  });

  it('returns false when content-type is missing', () => {
    expect(isImageResponse({})).toBe(false);
    expect(isImageResponse(undefined)).toBe(false);
  });
});

describe('defaultResponseTab', () => {
  it('returns preview for HTML responses', () => {
    expect(
      defaultResponseTab({
        body: '<html><body>Hi</body></html>',
        headers: { 'content-type': 'text/html' }
      })
    ).toBe('preview');
  });

  it('returns preview for image responses', () => {
    expect(
      defaultResponseTab({
        body: '',
        headers: { 'content-type': 'image/png' }
      })
    ).toBe('preview');
  });

  it('returns body for JSON responses', () => {
    expect(
      defaultResponseTab({
        body: '{"ok":true}',
        headers: { 'content-type': 'application/json' }
      })
    ).toBe('body');
  });

  it('returns body for null response', () => {
    expect(defaultResponseTab(null)).toBe('body');
  });
});

describe('buildHtmlPreviewSrcdoc', () => {
  it('wraps HTML fragments with CSP and document shell', () => {
    const srcdoc = buildHtmlPreviewSrcdoc('<p style="color:red">Hi</p>');
    expect(srcdoc).toContain('<!DOCTYPE html>');
    expect(srcdoc).toContain('Content-Security-Policy');
    expect(srcdoc).toContain('<p style="color:red">Hi</p>');
  });

  it('injects CSP into an existing head in full documents', () => {
    const srcdoc = buildHtmlPreviewSrcdoc(
      '<!DOCTYPE html><html><head><title>T</title></head><body></body></html>'
    );
    expect(srcdoc).toContain('<title>T</title>');
    expect(srcdoc).toContain('Content-Security-Policy');
  });

  it('adds head with CSP when full document lacks one', () => {
    const srcdoc = buildHtmlPreviewSrcdoc('<html><body>Hi</body></html>');
    expect(srcdoc).toContain('<head>');
    expect(srcdoc).toContain('Content-Security-Policy');
    expect(srcdoc).toContain('<body>Hi</body>');
  });

  it('allows stylesheets and images but blocks scripts in injected CSP', () => {
    const srcdoc = buildHtmlPreviewSrcdoc('<p>Hi</p>');
    expect(srcdoc).toContain("script-src 'none'");
    expect(srcdoc).toContain("script-src-elem 'none'");
    expect(srcdoc).not.toContain('default-src');
  });

  it('injects base href when baseUrl is provided', () => {
    const srcdoc = buildHtmlPreviewSrcdoc(
      '<link rel="stylesheet" href="/assets/app.css">',
      'https://api.example.com/v1/page'
    );
    expect(srcdoc).toContain('<base href="https://api.example.com/v1/page">');
  });

  it('does not inject base when document already has one', () => {
    const srcdoc = buildHtmlPreviewSrcdoc(
      '<html><head><base href="https://cdn.example.com/"></head><body></body></html>',
      'https://api.example.com/v1/page'
    );
    expect(srcdoc).not.toContain('<base href="https://api.example.com/v1/page">');
    expect(srcdoc).toContain('<base href="https://cdn.example.com/">');
  });

  it('strips server CSP meta before injecting preview CSP', () => {
    const srcdoc = buildHtmlPreviewSrcdoc(
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body></body></html>'
    );
    expect(srcdoc).not.toMatch(/content="default-src 'none'"/);
    expect(srcdoc).toContain("script-src 'none'");
  });
});

describe('resolveHtmlPreviewBaseUrl', () => {
  it('returns absolute href for valid https URLs', () => {
    expect(resolveHtmlPreviewBaseUrl('https://api.example.com/v1/users')).toBe(
      'https://api.example.com/v1/users'
    );
  });

  it('returns undefined for invalid URLs', () => {
    expect(resolveHtmlPreviewBaseUrl('not-a-url')).toBeUndefined();
    expect(resolveHtmlPreviewBaseUrl('')).toBeUndefined();
  });

  it('returns undefined for non-http(s) schemes', () => {
    expect(resolveHtmlPreviewBaseUrl('file:///tmp/page.html')).toBeUndefined();
  });
});
