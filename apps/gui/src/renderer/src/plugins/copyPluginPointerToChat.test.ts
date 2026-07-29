import { describe, expect, it } from 'vitest';
import {
  PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS,
  truncatePluginChatPointerContext
} from './copyPluginPointerToChat';

describe('truncatePluginChatPointerContext', () => {
  it('returns short context unchanged', () => {
    expect(truncatePluginChatPointerContext('hello')).toBe('hello');
  });

  it('truncates long context with a marker', () => {
    const input = 'x'.repeat(PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS + 10);
    const truncated = truncatePluginChatPointerContext(input);
    expect(truncated).toContain('…[truncated plugin context]');
    expect(truncated.startsWith('x'.repeat(PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS))).toBe(true);
    expect(truncated.length).toBe(
      PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS + '\n\n…[truncated plugin context]'.length
    );
  });
});
