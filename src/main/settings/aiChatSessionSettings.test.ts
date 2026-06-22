import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn()
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get = mockGet;
    set = mockSet;
  }
}));

describe('aiChatSessionSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns defaults when unset', async () => {
    const { getAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    expect(getAiChatSession()).toEqual({
      openTabIds: [],
      activeChatId: null
    });
  });

  it('dedupes tabs and picks a valid active chat id', async () => {
    mockGet.mockReturnValue({
      openTabIds: [3, 3, 7],
      activeChatId: 99
    });
    const { getAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    expect(getAiChatSession()).toEqual({
      openTabIds: [3, 7],
      activeChatId: 3
    });
  });

  it('persists normalized session state', async () => {
    const { setAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    setAiChatSession({ openTabIds: [4, 4, 8], activeChatId: 8 });

    expect(mockSet).toHaveBeenCalledWith('aiChatSession', {
      openTabIds: [4, 8],
      activeChatId: 8
    });
  });
});
