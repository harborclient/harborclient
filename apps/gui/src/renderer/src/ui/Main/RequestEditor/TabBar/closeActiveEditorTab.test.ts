import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { createTab } from '#/renderer/src/store/tabs';
import { closeActiveEditorTab } from './closeActiveEditorTab';

const closeRequestTabMock = vi.fn((tabId: string) => ({
  type: 'tabs/closeRequestTab',
  meta: { arg: tabId }
}));

vi.mock('#/renderer/src/store/thunks', async () => {
  const actual = await vi.importActual<typeof import('#/renderer/src/store/thunks')>(
    '#/renderer/src/store/thunks'
  );
  return {
    ...actual,
    closeRequestTab: (tabId: string) => closeRequestTabMock(tabId)
  };
});

/**
 * Builds a minimal root-state stub for closing a clean request tab.
 *
 * @param tab - Active request tab, or null when no tabs are open.
 * @returns Partial root state accepted by {@link closeActiveEditorTab}.
 */
function stateWithTab(tab: ReturnType<typeof createTab> | null): object {
  return {
    tabs: {
      tabs: tab == null ? [] : [tab],
      activeTabId: tab?.tabId ?? ''
    },
    settings: { general: { warnWhenClosingUnsavedRequests: true } },
    navigation: {
      collectionSettingsDirty: false,
      environmentSettingsDirty: false,
      folderSettingsDirty: false,
      workspaceSettingsDirty: false
    },
    themeDesigner: {
      initialized: false,
      history: { present: {}, past: [], future: [] },
      persistedDraft: {}
    },
    collections: { collections: [] },
    environments: { environments: [] },
    workspaces: { items: [] }
  };
}

describe('closeActiveEditorTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when there is no active tab', async () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    await closeActiveEditorTab(dispatch, () => stateWithTab(null) as never);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('closes a clean request tab without prompting', async () => {
    const tab = createTab();
    const dispatch = vi.fn((action: unknown) => action) as unknown as AppDispatch;

    await closeActiveEditorTab(dispatch, () => stateWithTab(tab) as never);

    expect(closeRequestTabMock).toHaveBeenCalledWith(tab.tabId);
    expect(dispatch).toHaveBeenCalled();
  });
});
