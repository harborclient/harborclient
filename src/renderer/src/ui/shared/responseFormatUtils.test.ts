import { describe, expect, it } from 'vitest';
import {
  buildHtmlPreviewSrcdoc,
  formatHeadersText,
  formatTestsText,
  isHtmlResponse,
  isImageResponse,
  isResponseCopyExportTab,
  resolveHtmlPreviewBaseUrl,
  responseBodyExportPath,
  responseTabExportPath,
  responseTabText
} from '#/renderer/src/ui/shared/responseFormatUtils';

describe('responseFormatUtils copy/export helpers', () => {
  it('isResponseCopyExportTab allows only Body and Headers tabs', () => {
    expect(isResponseCopyExportTab('body')).toBe(true);
    expect(isResponseCopyExportTab('headers')).toBe(true);
    expect(isResponseCopyExportTab('timing')).toBe(false);
    expect(isResponseCopyExportTab('console')).toBe(false);
    expect(isResponseCopyExportTab('preview')).toBe(false);
    expect(isResponseCopyExportTab('tests')).toBe(false);
  });

  it('formatHeadersText serializes headers as Key: Value lines', () => {
    expect(formatHeadersText({ 'Content-Type': 'application/json', 'X-Test': '1' })).toBe(
      'Content-Type: application/json\nX-Test: 1'
    );
    expect(formatHeadersText({})).toBe('');
  });

  it('formatTestsText serializes pass and fail results', () => {
    expect(
      formatTestsText([
        { name: 'status is 200', passed: true, scriptName: 'Request post-request script 1' },
        { name: 'has token', passed: false, error: 'missing field' }
      ])
    ).toBe('PASS [Request post-request script 1] status is 200\nFAIL has token — missing field');
  });

  it('responseBodyExportPath chooses json or txt extension', () => {
    expect(responseBodyExportPath('{"a":1}', { 'content-type': 'application/json' })).toBe(
      'response.json'
    );
    expect(responseBodyExportPath('plain text')).toBe('response.txt');
  });

  it('responseTabExportPath returns tab-specific default filenames', () => {
    expect(responseTabExportPath('body', '{"a":1}', {})).toBe('response.json');
    expect(responseTabExportPath('headers', '', {})).toBe('response-headers.txt');
    expect(responseTabExportPath('tests', '', {})).toBe('response-tests.txt');
  });

  it('responseTabText returns serialized content for each tab', () => {
    const headers = { 'Content-Type': 'text/plain' };
    const tests = [{ name: 'ok', passed: true }];

    expect(responseTabText('body', '{"a":1}', headers, tests)).toBe('{\n  "a": 1\n}');
    expect(responseTabText('headers', '', headers, tests)).toBe('Content-Type: text/plain');
    expect(responseTabText('tests', '', headers, tests)).toBe('PASS ok');
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
