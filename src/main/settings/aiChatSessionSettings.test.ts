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
      activeChatId: null,
      enterToSend: true
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
      activeChatId: 3,
      enterToSend: true
    });
  });

  it('defaults enterToSend to true when unset or invalid', async () => {
    mockGet.mockReturnValue({
      openTabIds: [1],
      activeChatId: 1,
      enterToSend: 'yes'
    });
    const { getAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    expect(getAiChatSession().enterToSend).toBe(true);
  });

  it('preserves enterToSend when explicitly false', async () => {
    mockGet.mockReturnValue({
      openTabIds: [1],
      activeChatId: 1,
      enterToSend: false
    });
    const { getAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    expect(getAiChatSession().enterToSend).toBe(false);
  });

  it('persists normalized session state', async () => {
    const { setAiChatSession } = await import('#/main/settings/aiChatSessionSettings');

    setAiChatSession({ openTabIds: [4, 4, 8], activeChatId: 8, enterToSend: false });

    expect(mockSet).toHaveBeenCalledWith('aiChatSession', {
      openTabIds: [4, 8],
      activeChatId: 8,
      enterToSend: false
    });
  });
});
