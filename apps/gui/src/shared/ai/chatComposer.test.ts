import { describe, expect, it } from 'vitest';
import { shouldSendChatOnKeyDown } from './chatComposer';

describe('shouldSendChatOnKeyDown', () => {
  it('sends on Enter when enterToSend is enabled', () => {
    expect(shouldSendChatOnKeyDown('Enter', false, false, false, true)).toBe(true);
  });

  it('does not send on Shift+Enter when enterToSend is enabled', () => {
    expect(shouldSendChatOnKeyDown('Enter', true, false, false, true)).toBe(false);
  });

  it('sends on Ctrl+Enter or Meta+Enter when enterToSend is disabled', () => {
    expect(shouldSendChatOnKeyDown('Enter', false, true, false, false)).toBe(true);
    expect(shouldSendChatOnKeyDown('Enter', false, false, true, false)).toBe(true);
  });

  it('does not send on plain Enter when enterToSend is disabled', () => {
    expect(shouldSendChatOnKeyDown('Enter', false, false, false, false)).toBe(false);
  });

  it('ignores non-Enter keys', () => {
    expect(shouldSendChatOnKeyDown('a', false, false, false, true)).toBe(false);
  });
});
