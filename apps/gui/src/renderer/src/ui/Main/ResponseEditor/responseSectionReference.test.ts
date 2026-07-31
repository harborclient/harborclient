import { describe, expect, it } from 'vitest';
import type { SendResult } from '@harborclient/http';
import {
  buildResponseBodySelectionReference,
  buildResponseSectionReference,
  isAiResponseSection
} from './responseSectionReference';

/**
 * Builds a minimal send result for snapshot tests.
 *
 * @param overrides - Partial fields to override.
 */
function sampleResponse(overrides: Partial<SendResult> = {}): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json', 'x-request-id': 'abc' },
    body: '{\n  "ok": true\n}',
    timeMs: 42,
    sizeBytes: 16,
    timing: {
      stalledMs: 1,
      connectMs: 2,
      requestSentMs: 3,
      waitingMs: 30,
      downloadMs: 6
    },
    ...overrides
  };
}

describe('isAiResponseSection', () => {
  it('accepts the five copy-to-chat sections', () => {
    expect(isAiResponseSection('body')).toBe(true);
    expect(isAiResponseSection('headers')).toBe(true);
    expect(isAiResponseSection('timing')).toBe(true);
    expect(isAiResponseSection('console')).toBe(true);
    expect(isAiResponseSection('tests')).toBe(true);
  });

  it('rejects preview and redirects', () => {
    expect(isAiResponseSection('preview')).toBe(false);
    expect(isAiResponseSection('redirects')).toBe(false);
  });
});

describe('buildResponseSectionReference', () => {
  const requestTabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('builds a body token and snapshot', () => {
    const { token, snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Echo',
      section: 'body',
      response: sampleResponse()
    });

    expect(token).toBe(`@res.${requestTabId}.body`);
    expect(snapshot.label).toBe('Response body');
    expect(snapshot.requestName).toBe('Echo');
    expect(snapshot.section).toBe('body');
    expect(snapshot.status).toBe(200);
    expect(snapshot.statusText).toBe('OK');
    expect(snapshot.content).toContain('"ok": true');
  });

  it('builds a headers snapshot with sorted header lines', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Echo',
      section: 'headers',
      response: sampleResponse()
    });

    expect(snapshot.label).toBe('Response headers');
    expect(snapshot.content).toContain('200 OK');
    expect(snapshot.content).toContain('content-type: application/json');
    expect(snapshot.content).toContain('x-request-id: abc');
  });

  it('builds a timing snapshot with phase rows', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Echo',
      section: 'timing',
      response: sampleResponse()
    });

    expect(snapshot.label).toBe('Response timing');
    expect(snapshot.content).toContain('Total time: 42 ms');
    expect(snapshot.content).toContain('Waiting for server response: 30 ms');
  });

  it('builds a console snapshot with logs and errors', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Echo',
      section: 'console',
      response: sampleResponse(),
      scriptLogs: [{ message: 'hello', level: 'log', method: 'log', scriptName: 'Script' }],
      scriptError: 'boom',
      scriptErrors: [{ message: 'TypeError: x', scriptName: 'Assert', line: 3 }],
      executionEvents: [
        { type: 'variable', scope: 'environment', action: 'set', key: 'token', value: 'abc' }
      ],
      testResults: [{ name: 'ok', passed: true }]
    });

    expect(snapshot.label).toBe('Response console');
    expect(snapshot.content).toContain('Script logs:');
    expect(snapshot.content).toContain('- hello');
    expect(snapshot.content).toContain('Script error: boom');
    expect(snapshot.content).toContain('TypeError: x');
    expect(snapshot.content).toContain('variable set environment.token = abc');
    expect(snapshot.content).toContain('Tests: 1/1 passed');
  });

  it('builds a tests snapshot with pass/fail details', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Echo',
      section: 'tests',
      response: sampleResponse(),
      testResults: [
        { name: 'status ok', passed: true },
        {
          name: 'body shape',
          passed: false,
          error: 'expected true to be false',
          expected: 'true',
          actual: 'false',
          source: 'script.js',
          line: 4,
          column: 2
        }
      ]
    });

    expect(snapshot.label).toBe('Response tests');
    expect(snapshot.content).toContain('1/2 passed');
    expect(snapshot.content).toContain('[PASS] status ok');
    expect(snapshot.content).toContain('[FAIL] body shape (script.js:4:2)');
    expect(snapshot.content).toContain('expected true, got false');
  });

  it('notes image responses instead of dumping binary body', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Pic',
      section: 'body',
      response: sampleResponse({
        headers: { 'content-type': 'image/png' },
        body: '',
        sizeBytes: 1024
      })
    });

    expect(snapshot.content).toContain('Image response');
    expect(snapshot.content).toContain('Binary body omitted');
  });

  it('notes non-image binary responses instead of dumping base64 body', () => {
    const { snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName: 'Doc',
      section: 'body',
      response: sampleResponse({
        headers: { 'content-type': 'application/pdf' },
        body: '%PDF',
        bodyBase64: 'JVBERi0=',
        sizeBytes: 2048
      })
    });

    expect(snapshot.content).toContain('Binary response');
    expect(snapshot.content).toContain('Base64 body omitted');
  });
});

describe('buildResponseBodySelectionReference', () => {
  const requestTabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('builds a body selection token with line metadata against pretty-printed text', () => {
    const response = sampleResponse({ body: '{"cookies":{},"data":"x"}' });
    const formatted = '{\n  "cookies": {},\n  "data": "x"\n}';
    const startOffset = formatted.indexOf('"cookies"');
    const endOffset = formatted.indexOf(',\n  "data"') + 1;
    const selectedText = formatted.slice(startOffset, endOffset);

    const { token, snapshot } = buildResponseBodySelectionReference({
      requestTabId,
      requestName: 'Echo',
      response,
      selectedText,
      startOffset,
      endOffset
    });

    expect(token).toBe(`@res.${requestTabId}.body#${startOffset}.${endOffset}`);
    expect(snapshot.section).toBe('body');
    expect(snapshot.label).toBe('Response body');
    expect(snapshot.selectedText).toBe(selectedText);
    expect(snapshot.startOffset).toBe(startOffset);
    expect(snapshot.endOffset).toBe(endOffset);
    expect(snapshot.startLine).toBe(2);
    expect(snapshot.endLine).toBe(2);
    expect(snapshot.content).toContain('"cookies"');
    expect(snapshot.status).toBe(200);
  });

  it('clamps offsets to the pretty-printed body bounds', () => {
    const { snapshot } = buildResponseBodySelectionReference({
      requestTabId,
      requestName: 'Echo',
      response: sampleResponse({ body: '{"a":1}' }),
      selectedText: '',
      startOffset: -5,
      endOffset: 9999
    });

    expect(snapshot.startOffset).toBe(0);
    expect(snapshot.endOffset).toBeGreaterThan(0);
    expect(snapshot.selectedText).toBeDefined();
    expect(snapshot.selectedText!.length).toBeGreaterThan(0);
    expect(snapshot.startLine).toBe(1);
  });
});
