import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aiChatPanelElementId,
  focusAiChatComposerInPanel,
  focusAiChatComposerWhenMounted,
  runWhenComposerReady
} from './focusAiChatComposer';

describe('aiChatPanelElementId', () => {
  it('builds the panel id from the chat id', () => {
    expect(aiChatPanelElementId(42)).toBe('ai-chat-panel-42');
  });
});

describe('focusAiChatComposerInPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('focuses the chat message textbox in the linked panel', () => {
    const focus = vi.fn();
    const textbox = {
      focus,
      contains: () => false
    };
    const panel = {
      querySelector: vi.fn(() => textbox)
    };

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === aiChatPanelElementId(7) ? panel : null)),
      activeElement: textbox
    });

    expect(focusAiChatComposerInPanel(7)).toBe(true);
    expect(panel.querySelector).toHaveBeenCalledWith('[role="textbox"][aria-label="Chat message"]');
    expect(focus).toHaveBeenCalled();
  });

  it('returns false when the panel is missing', () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null),
      activeElement: null
    });

    expect(focusAiChatComposerInPanel(99)).toBe(false);
  });

  it('returns false when the composer textbox is missing', () => {
    const panel = {
      querySelector: vi.fn(() => null)
    };

    vi.stubGlobal('document', {
      getElementById: vi.fn(() => panel),
      activeElement: null
    });

    expect(focusAiChatComposerInPanel(3)).toBe(false);
  });
});

describe('runWhenComposerReady', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries until tryFocus succeeds', () => {
    const tryFocus = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    runWhenComposerReady(tryFocus, 8);

    expect(tryFocus).toHaveBeenCalledTimes(3);
  });

  it('stops after maxAttempts when tryFocus never succeeds', () => {
    const tryFocus = vi.fn(() => false);
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    runWhenComposerReady(tryFocus, 2);

    // Initial frame + 2 retries after failures.
    expect(tryFocus).toHaveBeenCalledTimes(3);
  });
});

describe('focusAiChatComposerWhenMounted', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules focus via requestAnimationFrame', () => {
    const focus = vi.fn();
    const textbox = {
      focus,
      contains: () => false
    };
    const panel = {
      querySelector: vi.fn(() => textbox)
    };

    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === aiChatPanelElementId(5) ? panel : null)),
      activeElement: textbox
    });

    const raf = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('requestAnimationFrame', raf);

    focusAiChatComposerWhenMounted(5);

    expect(raf).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
