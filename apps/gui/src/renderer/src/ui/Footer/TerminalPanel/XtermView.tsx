import { Terminal } from '@xterm/xterm';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CopyToChatButton } from '@harborclient/sdk/components';
import type { TerminalSettings } from '@harborclient/core/types';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector, useAppStore } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { selectTerminalSettings } from '#/renderer/src/store/slices/settingsSlice';
import { setTerminalSelection } from '#/renderer/src/store/slices/terminalsSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { subscribeThemeColorsApplied } from '#/renderer/src/plugins/themeRuntime';
import { ElectronClipboardProvider } from './electronClipboardProvider';
import { openTerminalWebLink } from './openTerminalWebLink';
import {
  registerTerminalInstance,
  registerTerminalSearchAddon,
  unregisterTerminalInstance
} from './terminalRegistry';
import {
  buildTerminalReferenceToken,
  captureTerminalSelection,
  getTerminalSelectionToolbarCoords,
  isCopyToChatShortcutEvent,
  TERMINAL_SELECTION_TOOLBAR_DELAY_MS
} from './terminalSelection';

interface Props {
  /**
   * Stable terminal tab id shared with Redux and IPC.
   */
  id: string;

  /**
   * 1-based index of this terminal tab in the footer switcher.
   */
  index: number;

  /**
   * Display label shown in the vertical terminal switcher.
   */
  title: string;

  /**
   * Working directory for the shell; blank values use the user home directory.
   */
  cwd: string;

  /**
   * Whether this terminal tab is currently selected in the switcher.
   */
  active: boolean;

  /**
   * Whether the footer terminal panel is open.
   */
  panelOpen: boolean;
}

/**
 * Reads a CSS custom property from the document root for xterm theming.
 *
 * @param name - CSS variable name including the leading `--`.
 * @param fallback - Value used when the property is missing.
 * @returns Resolved color string.
 */
function readThemeColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/**
 * Builds an xterm theme for the footer terminal.
 *
 * Background, foreground, cursor, and selection colors follow HarborClient CSS
 * variables for the active document theme.
 *
 * @returns Terminal theme colors for the active document theme.
 */
function buildXtermTheme(): Terminal['options']['theme'] {
  return {
    background: readThemeColor('--mac-terminal', '#000000'),
    foreground: readThemeColor('--mac-text', '#ffffff'),
    cursor: readThemeColor('--mac-accent', '#007acc'),
    selectionBackground: readThemeColor('--mac-selection', 'rgba(128, 128, 128, 0.35)'),
    black: '#000000',
    red: '#ff453a',
    green: '#32d74b',
    yellow: '#ffd60a',
    blue: '#4098dc',
    magenta: '#bf5af2',
    cyan: '#64d2ff',
    white: '#ffffff',
    brightBlack: '#8e8e93',
    brightRed: '#ff6961',
    brightGreen: '#30db5b',
    brightYellow: '#ffd426',
    brightBlue: '#409cff',
    brightMagenta: '#da8fff',
    brightCyan: '#70d7ff',
    brightWhite: '#ffffff'
  };
}

/**
 * Returns whether the user prefers reduced motion for terminal cursor effects.
 *
 * @returns True when reduced motion is requested.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Applies persisted terminal settings to a live xterm instance.
 *
 * `blinkIntervalDuration` is set only when the installed xterm.js build exposes
 * the option (present on master / 6.1+, absent on 6.0.0).
 *
 * @param terminal - Active xterm instance.
 * @param settings - Persisted terminal appearance options.
 */
function applyTerminalSettings(terminal: Terminal, settings: TerminalSettings): void {
  terminal.options.scrollback = settings.scrollback;
  terminal.options.cursorBlink = settings.cursorBlink && !prefersReducedMotion();
  terminal.options.cursorStyle = settings.cursorStyle;
  terminal.options.fastScrollSensitivity = settings.fastScrollSensitivity;
  terminal.options.fontSize = settings.fontSize;
  terminal.options.fontFamily = settings.fontFamily;
  terminal.options.fontWeight = settings.fontWeight;
  terminal.options.minimumContrastRatio = settings.minimumContrastRatio;
  terminal.options.screenReaderMode = settings.screenReaderMode;

  if ('blinkIntervalDuration' in terminal.options) {
    (
      terminal.options as Terminal['options'] & { blinkIntervalDuration?: number }
    ).blinkIntervalDuration = settings.blinkIntervalDuration;
  }
}

/** Lines from the buffer bottom before auto-scroll stops following new output. */
const SCROLL_PIN_THRESHOLD_LINES = 3;

/** Animation frames to wait for a visible container before spawning the shell. */
const LAYOUT_WAIT_MAX_FRAMES = 10;

/**
 * Returns whether an element has non-zero layout so xterm can measure columns and rows.
 *
 * @param element - Terminal container element.
 * @returns True when width and height are both greater than zero.
 */
function hasVisibleSize(element: HTMLElement): boolean {
  return element.clientWidth > 0 && element.clientHeight > 0;
}

/**
 * Waits until the container has measurable dimensions or the attempt budget is exhausted.
 *
 * @param element - Terminal container element.
 * @param maxFrames - Maximum animation frames to wait.
 * @returns Promise that resolves when the container is measurable or waiting stops.
 */
async function waitForVisibleSize(element: HTMLElement, maxFrames: number): Promise<void> {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (hasVisibleSize(element)) {
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }
}

/**
 * Returns whether the terminal viewport is pinned to (or very near) the bottom.
 *
 * @param terminal - Active xterm instance.
 * @param thresholdLines - Maximum lines above the bottom that still count as pinned.
 * @returns True when new output should auto-scroll.
 */
function isViewportNearBottom(
  terminal: Terminal,
  thresholdLines = SCROLL_PIN_THRESHOLD_LINES
): boolean {
  const buffer = terminal.buffer.active;
  return buffer.baseY - buffer.viewportY <= thresholdLines;
}

/**
 * Writes PTY output and scrolls to the bottom when the viewport is pinned there.
 *
 * @param terminal - Active xterm instance.
 * @param data - Raw terminal output to append.
 */
function writeTerminalOutput(terminal: Terminal, data: string): void {
  const stickToBottom = isViewportNearBottom(terminal);
  terminal.write(data, () => {
    if (stickToBottom) {
      terminal.scrollToBottom();
    }
  });
}

/**
 * Writes one terminal line and scrolls to the bottom when the viewport is pinned there.
 *
 * @param terminal - Active xterm instance.
 * @param data - Line content to append before a newline.
 */
function writelnTerminalOutput(terminal: Terminal, data: string): void {
  const stickToBottom = isViewportNearBottom(terminal);
  terminal.writeln(data, () => {
    if (stickToBottom) {
      terminal.scrollToBottom();
    }
  });
}

/**
 * Renders one xterm.js instance backed by a main-process pseudo-terminal session.
 */
export function XtermView({ id, index, title, cwd, active, panelOpen }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const activeChatId = useAppSelector(selectActiveChatId);
  const terminalSettings = useAppSelector(selectTerminalSettings);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionReadyRef = useRef(false);
  const unmountingRef = useRef(false);
  const sessionDisposingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * True while FitAddon is applying a size so ResizeObserver can ignore the
   * layout thrash that would otherwise schedule another fit.
   */
  const fittingRef = useRef(false);
  const selectionToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  const aiAvailableRef = useRef(aiAvailable);
  const terminalSettingsRef = useRef(terminalSettings);
  const handleCopySelectionToChatRef = useRef<() => Promise<void>>(async () => {});
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [selectionToolbarCoords, setSelectionToolbarCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const shouldAttach = active && panelOpen;

  /**
   * Keeps the latest terminal settings on a ref so the create effect can seed
   * new xterm instances without recreating them when settings change.
   */
  useEffect(() => {
    terminalSettingsRef.current = terminalSettings;
  }, [terminalSettings]);

  /**
   * Keeps latest active/AI-availability values on refs so the selection-change
   * handler (registered once by the terminal-creation effect) can read fresh
   * state without forcing the xterm instance to be torn down and recreated.
   */
  useEffect(() => {
    activeRef.current = active;
    aiAvailableRef.current = aiAvailable;
  }, [active, aiAvailable]);

  /**
   * Hides the floating copy-to-chat toolbar and clears any pending show timer.
   */
  const hideSelectionToolbar = useCallback((): void => {
    if (selectionToolbarTimerRef.current != null) {
      clearTimeout(selectionToolbarTimerRef.current);
      selectionToolbarTimerRef.current = null;
    }

    setSelectionToolbarVisible(false);
    setSelectionToolbarCoords(null);
  }, []);

  /**
   * Copies the current terminal selection into the AI chat composer.
   */
  const handleCopySelectionToChat = useCallback(async (): Promise<void> => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    const capture = captureTerminalSelection(terminal);
    if (capture == null) {
      return;
    }

    const token = buildTerminalReferenceToken(index, capture.startLine, capture.endLine);
    dispatch(
      setTerminalSelection({
        token,
        snapshot: {
          terminalLabel: title,
          startLine: capture.startLine,
          endLine: capture.endLine,
          selectedText: capture.selectedText,
          contextText: capture.contextText
        }
      })
    );
    dispatch(setShowAiSidebar(true));
    if (activeChatId == null) {
      await dispatch(createNewChat(aiSettings));
    }

    dispatch(setPendingComposerText(token));
    terminal.clearSelection();
    hideSelectionToolbar();
  }, [activeChatId, aiSettings, dispatch, hideSelectionToolbar, index, title]);

  /**
   * Keeps the copy-to-chat handler ref aligned so the xterm key handler can call
   * the latest callback without re-registering on every render.
   */
  useEffect(() => {
    handleCopySelectionToChatRef.current = handleCopySelectionToChat;
  }, [handleCopySelectionToChat]);

  /**
   * Fits the terminal to its container and notifies the main process of the new size.
   *
   * Skips the PTY resize IPC when cols/rows are unchanged, and briefly ignores
   * ResizeObserver callbacks that fire as a side effect of the fit itself.
   */
  const fitTerminal = useCallback((): void => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (
      !terminal ||
      !fitAddon ||
      !container ||
      !hasVisibleSize(container) ||
      !sessionReadyRef.current
    ) {
      return;
    }

    const prevCols = terminal.cols;
    const prevRows = terminal.rows;
    fittingRef.current = true;
    fitAddon.fit();
    // Two frames: let FitAddon DOM updates settle and any ResizeObserver
    // callbacks from this fit drain before accepting new resize signals.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fittingRef.current = false;
      });
    });

    if (terminal.cols === prevCols && terminal.rows === prevRows) {
      return;
    }

    window.api.resizeTerminal(id, terminal.cols, terminal.rows);
  }, [id]);

  /**
   * Debounces resize handling so rapid panel drags do not flood IPC.
   */
  const scheduleFit = useCallback((): void => {
    if (fittingRef.current) {
      return;
    }

    if (resizeTimerRef.current != null) {
      clearTimeout(resizeTimerRef.current);
    }

    resizeTimerRef.current = setTimeout(() => {
      resizeTimerRef.current = null;
      fitTerminal();
    }, 80);
  }, [fitTerminal]);

  /**
   * Creates the xterm instance and wires terminal streaming IPC without spawning a shell.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    unmountingRef.current = false;

    const settings = terminalSettingsRef.current;
    const terminal = new Terminal({
      // SearchAddon decorations use xterm proposed APIs (registerDecoration / markers).
      allowProposedApi: true,
      scrollback: settings.scrollback,
      cursorBlink: settings.cursorBlink && !prefersReducedMotion(),
      cursorStyle: settings.cursorStyle,
      fastScrollSensitivity: settings.fastScrollSensitivity,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight,
      minimumContrastRatio: settings.minimumContrastRatio,
      screenReaderMode: settings.screenReaderMode,
      theme: buildXtermTheme()
    });
    if ('blinkIntervalDuration' in terminal.options) {
      (
        terminal.options as Terminal['options'] & { blinkIntervalDuration?: number }
      ).blinkIntervalDuration = settings.blinkIntervalDuration;
    }
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(
      new WebLinksAddon((_event, uri) => {
        openTerminalWebLink(dispatch, () => store.getState(), uri);
      })
    );
    terminal.loadAddon(new ClipboardAddon(undefined, new ElectronClipboardProvider()));
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    registerTerminalInstance(id, terminal);
    registerTerminalSearchAddon(id, searchAddon);

    terminal.attachCustomKeyEventHandler((event) => {
      if (!isCopyToChatShortcutEvent(event)) {
        return true;
      }

      if (!aiAvailableRef.current || !activeRef.current) {
        return true;
      }

      if (!terminal.hasSelection() || terminal.getSelection().trim().length === 0) {
        return true;
      }

      event.preventDefault();
      void handleCopySelectionToChatRef.current();
      return false;
    });

    const unsubscribeData = window.api.onTerminalData((event) => {
      if (event.id !== id) {
        return;
      }

      writeTerminalOutput(terminal, event.data);
    });

    const unsubscribeExit = window.api.onTerminalExit((event) => {
      if (event.id !== id || unmountingRef.current || sessionDisposingRef.current) {
        return;
      }

      sessionReadyRef.current = false;
      const codeLabel = event.exitCode == null ? 'unknown' : String(event.exitCode);
      writelnTerminalOutput(terminal, `[Process exited with code ${codeLabel}]`);
    });

    const dataDisposable = terminal.onData((data) => {
      if (sessionReadyRef.current) {
        window.api.writeTerminal(id, data);
      }
    });

    const selectionDisposable = terminal.onSelectionChange(() => {
      if (!aiAvailableRef.current || !activeRef.current) {
        hideSelectionToolbar();
        return;
      }

      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      if (!terminal.hasSelection() || terminal.getSelection().trim().length === 0) {
        hideSelectionToolbar();
        return;
      }

      selectionToolbarTimerRef.current = setTimeout(() => {
        selectionToolbarTimerRef.current = null;
        const coords = getTerminalSelectionToolbarCoords(terminal, container);
        if (coords == null) {
          hideSelectionToolbar();
          return;
        }

        setSelectionToolbarCoords(coords);
        setSelectionToolbarVisible(true);
      }, TERMINAL_SELECTION_TOOLBAR_DELAY_MS);
    });

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    resizeObserver.observe(container);

    const unsubscribeTheme = subscribeThemeColorsApplied(() => {
      terminal.options.theme = buildXtermTheme();
    });

    return () => {
      unmountingRef.current = true;
      sessionReadyRef.current = false;
      hideSelectionToolbar();
      unsubscribeData();
      unsubscribeExit();
      unsubscribeTheme();
      dataDisposable.dispose();
      selectionDisposable.dispose();
      resizeObserver.disconnect();
      if (resizeTimerRef.current != null) {
        clearTimeout(resizeTimerRef.current);
      }
      unregisterTerminalInstance(id);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [dispatch, hideSelectionToolbar, id, scheduleFit, store]);

  /**
   * Applies live terminal settings changes without recreating the PTY session.
   * Font metric changes trigger a fit/resize so cols/rows stay accurate.
   */
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    applyTerminalSettings(terminal, terminalSettings);
    scheduleFit();
  }, [scheduleFit, terminalSettings]);

  /**
   * Spawns or tears down the shell session when this tab becomes visible in the open panel.
   */
  useEffect(() => {
    if (!shouldAttach) {
      sessionReadyRef.current = false;
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
        selectionToolbarTimerRef.current = null;
      }
      return;
    }

    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (!terminal || !fitAddon || !container) {
      return;
    }

    let cancelled = false;
    sessionDisposingRef.current = false;

    void (async () => {
      await waitForVisibleSize(container, LAYOUT_WAIT_MAX_FRAMES);
      if (cancelled || !hasVisibleSize(container)) {
        return;
      }

      fitAddon.fit();

      await window.api.createTerminal({
        id,
        cwd: cwd.trim().length > 0 ? cwd : undefined,
        cols: Math.max(terminal.cols, 2),
        rows: Math.max(terminal.rows, 2)
      });
      if (cancelled || unmountingRef.current) {
        return;
      }

      sessionReadyRef.current = true;
      fitTerminal();
      terminal.scrollToBottom();
    })();

    return () => {
      cancelled = true;
      sessionReadyRef.current = false;
      sessionDisposingRef.current = true;
      void window.api.killTerminal(id);
    };
  }, [cwd, fitTerminal, id, shouldAttach]);

  /**
   * Refits and focuses the active terminal when its tab or panel visibility changes.
   */
  useEffect(() => {
    if (!shouldAttach) {
      return;
    }

    scheduleFit();
    const frame = requestAnimationFrame(() => {
      scheduleFit();
    });
    terminalRef.current?.focus();

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [shouldAttach, scheduleFit]);

  const showSelectionToolbar =
    selectionToolbarVisible && selectionToolbarCoords != null && aiAvailable && active && panelOpen;

  return (
    <div
      className={active ? 'absolute inset-0 flex min-h-0 min-w-0 bg-terminal' : 'hidden'}
      role="tabpanel"
      id={`footer-terminal-panel-${id}`}
      aria-labelledby={`footer-terminal-tab-${id}`}
      aria-hidden={!active}
    >
      <div ref={containerRef} className="h-full min-h-0 w-full min-w-0 p-2" />
      {showSelectionToolbar ? (
        <CopyToChatButton
          coords={selectionToolbarCoords}
          aria-label={`Copy selection from ${title} to chat`}
          onSelect={() => {
            void handleCopySelectionToChat();
          }}
        />
      ) : null}
    </div>
  );
}
