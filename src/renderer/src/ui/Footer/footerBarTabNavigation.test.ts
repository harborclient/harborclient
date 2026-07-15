import { describe, expect, it } from 'vitest';
import {
  isFooterFocusOnLastLeftButton,
  resolveFooterBarTabHandoff
} from './footerBarTabNavigation';

describe('resolveFooterBarTabHandoff', () => {
  it('moves Tab forward from the last left control to the first right icon', () => {
    const shortcuts = {} as HTMLElement;
    const consoleButton = {} as HTMLElement;
    const requestEditor = {} as HTMLElement;
    const sidebar = {} as HTMLElement;

    expect(
      resolveFooterBarTabHandoff(
        false,
        consoleButton,
        [shortcuts, consoleButton],
        [requestEditor, sidebar]
      )
    ).toBe(requestEditor);
  });

  it('moves Shift+Tab backward from the first right icon to the last left control', () => {
    const shortcuts = {} as HTMLElement;
    const consoleButton = {} as HTMLElement;
    const requestEditor = {} as HTMLElement;

    expect(
      resolveFooterBarTabHandoff(true, requestEditor, [shortcuts, consoleButton], [requestEditor])
    ).toBe(consoleButton);
  });

  it('returns null when focus is not on a group boundary', () => {
    const shortcuts = {} as HTMLElement;
    const consoleButton = {} as HTMLElement;
    const requestEditor = {} as HTMLElement;

    expect(
      resolveFooterBarTabHandoff(false, shortcuts, [shortcuts, consoleButton], [requestEditor])
    ).toBeNull();
  });

  it('returns null when either footer group has no focusable controls', () => {
    const consoleButton = {} as HTMLElement;

    expect(resolveFooterBarTabHandoff(false, consoleButton, [consoleButton], [])).toBeNull();
    expect(resolveFooterBarTabHandoff(false, consoleButton, [], [consoleButton])).toBeNull();
  });
});

describe('isFooterFocusOnLastLeftButton', () => {
  it('treats nested focus inside the last left button as a boundary', () => {
    const shortcuts = {} as HTMLElement;
    const consoleButton = {
      contains: (node: Element) => node === nestedFocus
    } as HTMLElement;
    const nestedFocus = {} as HTMLElement;

    expect(isFooterFocusOnLastLeftButton(nestedFocus, [shortcuts, consoleButton])).toBe(true);
  });
});
