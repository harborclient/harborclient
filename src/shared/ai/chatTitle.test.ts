import { describe, expect, it } from 'vitest';
import {
  buildChatTitleSystemPrompt,
  DEFAULT_CHAT_TITLE,
  normalizeChatTitle,
  parseChatTitleResult
} from '#/shared/ai/chatTitle';

describe('buildChatTitleSystemPrompt', () => {
  it('instructs the model to call set_chat_title', () => {
    const prompt = buildChatTitleSystemPrompt();

    expect(prompt).toContain('set_chat_title');
    expect(prompt).toContain('3-5 words');
  });
});

describe('normalizeChatTitle', () => {
  it('collapses whitespace and strips trailing punctuation', () => {
    expect(normalizeChatTitle('  OAuth   token   refresh.  ')).toBe('OAuth token refresh');
  });

  it('removes wrapping quotes', () => {
    expect(normalizeChatTitle('"List API collections"')).toBe('List API collections');
  });

  it('truncates long titles', () => {
    const longTitle = 'This is an unusually long chat title that should be truncated';
    expect(normalizeChatTitle(longTitle).length).toBeLessThanOrEqual(40);
    expect(normalizeChatTitle(longTitle).endsWith('…')).toBe(true);
  });

  it('returns the default title for empty input', () => {
    expect(normalizeChatTitle('   ')).toBe(DEFAULT_CHAT_TITLE);
  });
});

describe('parseChatTitleResult', () => {
  it('reads set_chat_title tool call arguments', () => {
    const title = parseChatTitleResult({
      content: null,
      toolCalls: [
        {
          id: '1',
          name: 'set_chat_title',
          arguments: JSON.stringify({ title: 'OAuth token refresh' })
        }
      ]
    });

    expect(title).toBe('OAuth token refresh');
  });

  it('normalizes quoted titles from the tool call', () => {
    const title = parseChatTitleResult({
      content: null,
      toolCalls: [
        {
          id: '1',
          name: 'set_chat_title',
          arguments: JSON.stringify({ title: '"Debug login request"' })
        }
      ]
    });

    expect(title).toBe('Debug login request');
  });

  it('falls back to plain assistant content', () => {
    const title = parseChatTitleResult({
      content: 'Compare response headers',
      toolCalls: []
    });

    expect(title).toBe('Compare response headers');
  });

  it('returns null when no usable response is present', () => {
    expect(
      parseChatTitleResult({
        content: null,
        toolCalls: [{ id: '1', name: 'other_tool', arguments: '{}' }]
      })
    ).toBeNull();
  });

  it('returns null for invalid tool arguments', () => {
    expect(
      parseChatTitleResult({
        content: null,
        toolCalls: [{ id: '1', name: 'set_chat_title', arguments: 'not-json' }]
      })
    ).toBeNull();
  });
});
