import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from '@harborclient/core/types';
import {
  createLivePageForPlugin,
  deleteLivePageForPlugin,
  getLivePageForPlugin,
  listLivePagesForPlugin,
  updateLivePageForPlugin
} from './hostLivePageCommands';

const listWebsitesMock = vi.fn();
const createWebsiteMock = vi.fn();
const updateWebsiteMock = vi.fn();
const deleteWebsiteMock = vi.fn();
const dispatchMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => ({
      websites: {
        items: [] as Website[]
      }
    })
  }
}));

/**
 * Builds a minimal saved website fixture.
 *
 * @param overrides - Fields to override on the base row.
 * @returns Website row for tests.
 */
function makeWebsite(overrides: Partial<Website> = {}): Website {
  return {
    id: 1,
    uuid: 'lp-1',
    name: 'Example',
    url: 'https://example.com/',
    homeUrl: 'https://example.com/',
    faviconDataUrl: null,
    scripts: [],
    preRequestScripts: [],
    postRequestScripts: [],
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

beforeEach(() => {
  listWebsitesMock.mockReset();
  createWebsiteMock.mockReset();
  updateWebsiteMock.mockReset();
  deleteWebsiteMock.mockReset();
  dispatchMock.mockReset();
  vi.stubGlobal('window', {
    api: {
      listWebsites: listWebsitesMock,
      createWebsite: createWebsiteMock,
      updateWebsite: updateWebsiteMock,
      deleteWebsite: deleteWebsiteMock
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hostLivePageCommands', () => {
  it('lists and gets saved live pages by id or uuid', async () => {
    const saved = makeWebsite();
    listWebsitesMock.mockResolvedValue([saved]);

    await expect(listLivePagesForPlugin()).resolves.toEqual([saved]);
    await expect(getLivePageForPlugin(1)).resolves.toEqual(saved);
    await expect(getLivePageForPlugin('lp-1')).resolves.toEqual(saved);
    await expect(getLivePageForPlugin(99)).resolves.toBeNull();
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('creates a saved live page and returns the new row', async () => {
    const created = makeWebsite({
      id: 2,
      uuid: 'lp-2',
      name: 'New',
      connectionId: 'team-hub-1'
    });
    createWebsiteMock.mockResolvedValue([created]);

    const input: CreateWebsiteInput = {
      name: 'New',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      connectionId: 'team-hub-1'
    };

    await expect(createLivePageForPlugin(input)).resolves.toEqual(created);
    expect(createWebsiteMock).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'team-hub-1' })
    );
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('updates a saved live page and returns the refreshed row', async () => {
    const updated = makeWebsite({ name: 'Renamed' });
    updateWebsiteMock.mockResolvedValue([updated]);

    const input: UpdateWebsiteInput = {
      id: 1,
      name: 'Renamed',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      faviconDataUrl: null,
      scripts: [],
      preRequestScripts: [],
      postRequestScripts: [],
      variables: [],
      headers: [],
      userAgent: '',
      auth: defaultAuth()
    };

    await expect(updateLivePageForPlugin(input)).resolves.toEqual(updated);
    expect(updateWebsiteMock).toHaveBeenCalledWith(input);
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('deletes a saved live page and refreshes the list', async () => {
    deleteWebsiteMock.mockResolvedValue([]);

    await expect(deleteLivePageForPlugin(1)).resolves.toBeUndefined();
    expect(deleteWebsiteMock).toHaveBeenCalledWith(1);
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('rejects delete when id is not a finite number', async () => {
    await expect(deleteLivePageForPlugin(Number.NaN)).rejects.toThrow(
      /hc\.livePages\.delete requires a numeric id/
    );
    expect(deleteWebsiteMock).not.toHaveBeenCalled();
  });
});
