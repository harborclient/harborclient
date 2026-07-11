import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useCallback, useEffect, useRef, type JSX } from 'react';

interface Props {
  /**
   * Stable terminal tab id shared with Redux and IPC.
   */
  id: string;

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
 * Builds an xterm theme aligned with HarborClient CSS variables.
 *
 * @returns Terminal theme colors for the active document theme.
 */
function buildXtermTheme(): Terminal['options']['theme'] {
  return {
    background: readThemeColor('--mac-sidebar', '#252526'),
    foreground: readThemeColor('--mac-text', '#ffffff'),
    cursor: readThemeColor('--mac-accent', '#007aff'),
    selectionBackground: readThemeColor('--mac-selection', 'rgba(128, 128, 128, 0.35)'),
    black: '#000000',
    red: '#ff453a',
    green: '#32d74b',
    yellow: '#ffd60a',
    blue: '#0a84ff',
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
export function XtermView({ id, cwd, active, panelOpen }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionReadyRef = useRef(false);
  const unmountingRef = useRef(false);
  const sessionDisposingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldAttach = active && panelOpen;

  /**
   * Fits the terminal to its container and notifies the main process of the new size.
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

    fitAddon.fit();
    window.api.resizeTerminal(id, terminal.cols, terminal.rows);
  }, [id]);

  /**
   * Debounces resize handling so rapid panel drags do not flood IPC.
   */
  const scheduleFit = useCallback((): void => {
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

    const terminal = new Terminal({
      cursorBlink: !prefersReducedMotion(),
      fontSize: 16,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      screenReaderMode: true,
      theme: buildXtermTheme()
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

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

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    resizeObserver.observe(container);

    return () => {
      unmountingRef.current = true;
      sessionReadyRef.current = false;
      unsubscribeData();
      unsubscribeExit();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      if (resizeTimerRef.current != null) {
        clearTimeout(resizeTimerRef.current);
      }
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [id, scheduleFit]);

  /**
   * Spawns or tears down the shell session when this tab becomes visible in the open panel.
   */
  useEffect(() => {
    if (!shouldAttach) {
      sessionReadyRef.current = false;
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
  }, [id, cwd, shouldAttach, fitTerminal]);

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

  return (
    <div
      className={active ? 'absolute inset-0 flex min-h-0 min-w-0' : 'hidden'}
      role="tabpanel"
      id={`footer-terminal-panel-${id}`}
      aria-labelledby={`footer-terminal-tab-${id}`}
      aria-hidden={!active}
    >
      <div ref={containerRef} className="h-full min-h-0 w-full min-w-0 p-2" />
    </div>
  );
}
