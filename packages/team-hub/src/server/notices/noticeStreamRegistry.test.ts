import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeAllNoticeStreams,
  getOpenNoticeStreamCount,
  registerNoticeStream
} from '#/server/notices/noticeStreamRegistry.js';

describe('noticeStreamRegistry', () => {
  afterEach(() => {
    closeAllNoticeStreams();
  });

  it('tracks registered streams and unregisters without calling cleanup', () => {
    const cleanup = vi.fn();
    const unregister = registerNoticeStream(cleanup);

    expect(getOpenNoticeStreamCount()).toBe(1);
    unregister();
    expect(getOpenNoticeStreamCount()).toBe(0);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('closes all streams and clears the registry', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerNoticeStream(first);
    registerNoticeStream(second);

    closeAllNoticeStreams();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(getOpenNoticeStreamCount()).toBe(0);
  });

  it('is idempotent when closeAllNoticeStreams is called twice', () => {
    const cleanup = vi.fn();
    registerNoticeStream(cleanup);

    closeAllNoticeStreams();
    closeAllNoticeStreams();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(getOpenNoticeStreamCount()).toBe(0);
  });
});
