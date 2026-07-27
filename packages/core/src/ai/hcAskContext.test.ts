import { describe, expect, it } from 'vitest';
import {
  buildHcAskContextMessage,
  buildHcAskSystemPrompt,
  HC_ASK_SYSTEM_PROMPT
} from './hcAskContext';
import type { ScriptRunInput, SendResult } from '../types';

/**
 * Minimal script run input for context builder tests.
 *
 * @param overrides - Fields to merge onto the base input.
 */
function baseInput(overrides: Partial<ScriptRunInput> = {}): ScriptRunInput {
  return {
    phase: 'pre',
    script: '',
    request: {
      method: 'GET',
      url: 'https://example.com/image.png',
      headers: [{ key: 'Accept', value: 'image/png', enabled: true }],
      params: [],
      body: '',
      bodyType: 'none'
    },
    variables: {},
    ...overrides
  };
}

describe('buildHcAskSystemPrompt', () => {
  it('returns the shared prompt that references send context and sizeBytes', () => {
    expect(buildHcAskSystemPrompt()).toBe(HC_ASK_SYSTEM_PROMPT);
    expect(HC_ASK_SYSTEM_PROMPT).toContain('sizeBytes');
    expect(HC_ASK_SYSTEM_PROMPT).toContain('HarborClient send context');
  });
});

describe('buildHcAskContextMessage', () => {
  it('returns empty string when run input is missing', () => {
    expect(buildHcAskContextMessage(undefined)).toBe('');
  });

  it('includes request and omits response for pre-request scripts', () => {
    const message = buildHcAskContextMessage(baseInput({ phase: 'pre' }));
    expect(message).toContain('"phase": "pre"');
    expect(message).toContain('https://example.com/image.png');
    expect(message).toContain('"Accept": "image/png"');
    expect(message).not.toContain('"response"');
  });

  it('includes sizeBytes and omits base64 for image responses', () => {
    const response: SendResult = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'image/png' },
      body: '',
      bodyBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      timeMs: 42,
      sizeBytes: 68
    };

    const message = buildHcAskContextMessage(
      baseInput({
        phase: 'post',
        response
      })
    );

    expect(message).toContain('"phase": "post"');
    expect(message).toContain('"sizeBytes": 68');
    expect(message).toContain('"bodyKind": "binary"');
    expect(message).not.toContain('iVBORw0KGgo');
    expect(message).not.toContain('bodyBase64');
  });

  it('includes truncated body preview for text responses', () => {
    const response: SendResult = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true,"name":"Ada"}',
      timeMs: 10,
      sizeBytes: 24
    };

    const message = buildHcAskContextMessage(
      baseInput({
        phase: 'post',
        response
      })
    );

    expect(message).toContain('"sizeBytes": 24');
    expect(message).toContain('\\"ok\\":true');
    expect(message).not.toContain('"bodyKind": "binary"');
  });
});
