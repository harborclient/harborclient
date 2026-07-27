import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadDocumentForPlugin,
  openCollectionRunnerForPlugin,
  openCollectionSettingsForPlugin,
  openShareModalForPlugin
} from './hostNavigationCommands';

const dispatchMock = vi.fn();
const getStateMock = vi.fn();
const listCollectionsMock = vi.fn();
const listDocumentsMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => getStateMock()
  }
}));

vi.mock('#/renderer/src/store/slices/modalsSlice', () => ({
  openCollectionRunner: (payload: unknown) => ({ type: 'openCollectionRunner', payload }),
  openShareModal: (payload: unknown) => ({ type: 'openShareModal', payload })
}));

vi.mock('#/renderer/src/store/slices/tabsSlice', () => ({
  openPageTab: (payload: unknown) => ({ type: 'openPageTab', payload })
}));

vi.mock('#/renderer/src/store/thunks/collections', () => ({
  focusSidebarItem: (payload: unknown) => ({ type: 'focusSidebarItem', payload })
}));

vi.mock('#/renderer/src/store/thunks/documents', () => ({
  requestLoadDocument: (payload: unknown) => ({
    type: 'requestLoadDocument',
    payload,
    unwrap: vi.fn()
  })
}));

vi.mock('#/renderer/src/store/thunks/modals', () => ({
  loadTrustedKeys: () => ({ type: 'loadTrustedKeys' })
}));

beforeEach(() => {
  dispatchMock.mockReset();
  getStateMock.mockReset();
  listCollectionsMock.mockReset();
  listDocumentsMock.mockReset();
  getStateMock.mockReturnValue({
    collections: {
      collections: [{ id: 5, name: 'Pets' }],
      documentsByCollection: {
        5: [
          {
            id: 11,
            collection_id: 5,
            folder_id: null,
            name: 'readme.md',
            content: '# hi'
          }
        ]
      },
      requestsByCollection: {},
      foldersByCollection: {}
    },
    tabs: { tabs: [], activeTabId: null }
  });
  vi.stubGlobal('window', {
    api: {
      listCollections: listCollectionsMock,
      listDocuments: listDocumentsMock
    }
  });
});

describe('hostNavigationCommands', () => {
  it('opens collection settings via openPageTab', () => {
    openCollectionSettingsForPlugin(5);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'openPageTab',
      payload: { type: 'collection', id: 5 }
    });
  });

  it('opens the collection runner with cached name', () => {
    openCollectionRunnerForPlugin(5);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'openCollectionRunner',
      payload: { collectionId: 5, collectionName: 'Pets' }
    });
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'openPageTab',
      payload: { type: 'collection-runner', collectionId: 5 }
    });
  });

  it('opens the share modal and loads trusted keys', () => {
    openShareModalForPlugin(5);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'openShareModal',
      payload: { collectionId: 5, collectionName: 'Pets' }
    });
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'loadTrustedKeys' });
  });

  it('loads a cached document and focuses its sidebar parents', async () => {
    await loadDocumentForPlugin(11);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'focusSidebarItem',
      payload: { collectionId: 5, folderId: null }
    });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'requestLoadDocument',
        payload: expect.objectContaining({
          doc: expect.objectContaining({ id: 11 })
        })
      })
    );
  });

  it('rejects non-numeric ids', () => {
    expect(() => openCollectionSettingsForPlugin('x' as never)).toThrow(/numeric/);
  });
});
