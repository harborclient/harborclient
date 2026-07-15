import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionDocument } from '#/shared/types';
import { isMarkdownTab, isTabDirty } from '#/renderer/src/store/tabs';

// react-hot-toast pulls in the DOM at import time; stub it for the Node test env.
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));

/**
 * Minimal in-memory localStorage mock so Redux subscribers can run in Node.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

const listDocumentsMock = vi.fn<(collectionId: number) => Promise<CollectionDocument[]>>();

/**
 * Builds a collection document fixture for refreshDocuments tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved document returned by the listDocuments mock.
 */
function sampleDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 1,
    uuid: 'doc-uuid',
    collection_id: 10,
    folder_id: null,
    name: 'README.md',
    content: '# Hello',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      listDocuments: listDocumentsMock,
      setOpenTabsPayload: vi.fn().mockResolvedValue(undefined)
    }
  });
  listDocumentsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshDocuments', () => {
  it('reconciles falsely dirty open markdown tabs after listing documents', async () => {
    const doc = sampleDocument({ content: '# Hello' });
    listDocumentsMock.mockResolvedValue([doc]);

    const { store } = await import('#/renderer/src/store/redux');
    const { openMarkdownTab, updateMarkdownContent, closeTab } =
      await import('#/renderer/src/store/slices/tabsSlice');
    const { refreshDocuments } = await import('#/renderer/src/store/thunks/documents');

    for (const tab of [...store.getState().tabs.tabs]) {
      store.dispatch(closeTab(tab.tabId));
    }

    store.dispatch(openMarkdownTab({ doc }));
    const tabId = store.getState().tabs.activeTabId;
    store.dispatch(updateMarkdownContent({ tabId, content: '# Hello\n' }));

    const openTab = store.getState().tabs.tabs.find((entry) => entry.tabId === tabId);
    expect(openTab).toBeDefined();
    if (openTab == null) {
      throw new Error('expected open tab');
    }
    expect(isTabDirty(openTab)).toBe(true);

    await store.dispatch(refreshDocuments(10));

    const tab = store.getState().tabs.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (tab == null || !isMarkdownTab(tab)) {
      throw new Error('expected markdown tab');
    }
    expect(tab.content).toBe('# Hello');
    expect(tab.savedContent).toBe('# Hello');
    expect(isTabDirty(tab)).toBe(false);
    expect(listDocumentsMock).toHaveBeenCalledWith(10);
  });
});
