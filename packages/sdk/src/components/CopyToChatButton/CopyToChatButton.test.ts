import { describe, expect, it } from 'vitest';
import {
  COPY_TO_CHAT_LABEL,
  COPY_TO_CHAT_SHORTCUT_HINT,
  copyToChatActionLabel
} from './constants.js';

describe('copyToChatActionLabel', () => {
  it('includes the shared label and shortcut hint', () => {
    expect(copyToChatActionLabel()).toBe(`${COPY_TO_CHAT_LABEL} (${COPY_TO_CHAT_SHORTCUT_HINT})`);
  });
});
