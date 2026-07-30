import { describe, expect, it } from 'vitest';
import { isLeaveBrowserUnloadChoice } from './browserUnloadPrompt';

describe('isLeaveBrowserUnloadChoice', () => {
  it('treats button index 0 as Leave', () => {
    expect(isLeaveBrowserUnloadChoice(0)).toBe(true);
  });

  it('treats Stay and other indices as keep-page', () => {
    expect(isLeaveBrowserUnloadChoice(1)).toBe(false);
    expect(isLeaveBrowserUnloadChoice(2)).toBe(false);
  });
});
