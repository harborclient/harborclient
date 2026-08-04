import { describe, expect, it } from 'vitest';
import { createPageTab, createTab } from '#/renderer/src/store/tabs';
import { isDirtyForClose } from './isDirtyForClose';

describe('isDirtyForClose', () => {
  it('prompts for dirty request tabs when the warning setting is on', () => {
    const tab = createTab();
    tab.draft = { ...tab.draft, name: 'Users renamed' };

    expect(isDirtyForClose(tab, tab.tabId, false, false, false, false, true, false)).toBe(true);
  });

  it('skips request dirty prompts when the warning setting is off', () => {
    const tab = createTab();
    tab.draft = { ...tab.draft, name: 'Changed' };

    expect(isDirtyForClose(tab, tab.tabId, false, false, false, false, false, false)).toBe(false);
  });

  it('prompts for a dirty Themes page regardless of the request warning setting', () => {
    const tab = createPageTab({ type: 'themes' });

    expect(isDirtyForClose(tab, tab.tabId, false, false, false, false, false, true)).toBe(true);
  });

  it('prompts for active collection settings when that form is dirty', () => {
    const tab = createPageTab({ type: 'collection', id: 1 });

    expect(isDirtyForClose(tab, tab.tabId, true, false, false, false, false, false)).toBe(true);
  });
});
