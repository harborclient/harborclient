import os from 'os';
import { spawn, type IPty } from 'node-pty';
import type { WebContents } from 'electron';

/**
 * Live pseudo-terminal session bound to one renderer tab id and webContents.
 */
interface TerminalSession {
  pty: IPty;
  webContents: WebContents;
  /**
   * Monotonic token used to ignore stale onExit callbacks from replaced sessions.
   */
  generation: number;
}

const sessions = new Map<string, TerminalSession>();

let nextTerminalGeneration = 0;

/**
 * Resolves the default interactive shell for the current platform.
 *
 * @returns Absolute path to the shell executable.
 */
function resolveShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC ?? 'powershell.exe';
  }

  return process.env.SHELL ?? '/bin/bash';
}

/**
 * Options used when spawning a new pseudo-terminal session.
 */
export interface CreateTerminalOptions {
  /**
   * Stable tab id shared with the renderer and persistence layer.
   */
  id: string;

  /**
   * Working directory; blank values fall back to the user home directory.
   */
  cwd?: string;

  /**
   * Initial terminal width in columns.
   */
  cols: number;

  /**
   * Initial terminal height in rows.
   */
  rows: number;
}

/**
 * Spawns a shell in a pseudo-terminal and streams I/O to the owning webContents.
 *
 * @param options - Session id, optional cwd, and initial terminal dimensions.
 * @param webContents - Renderer webContents that owns the session.
 * @returns The created session id.
 */
export function createTerminal(
  options: CreateTerminalOptions,
  webContents: WebContents
): { id: string } {
  const { id, cols, rows } = options;
  const cwd = options.cwd?.trim() ? options.cwd.trim() : os.homedir();

  killTerminal(id);

  const generation = ++nextTerminalGeneration;

  const pty = spawn(resolveShell(), [], {
    name: 'xterm-color',
    cols: Math.max(cols, 2),
    rows: Math.max(rows, 2),
    cwd,
    env: process.env as Record<string, string>
  });

  pty.onData((data) => {
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:data', { id, data });
    }
  });

  pty.onExit(({ exitCode }) => {
    const session = sessions.get(id);
    if (!session || session.generation !== generation) {
      return;
    }

    sessions.delete(id);
    if (!webContents.isDestroyed()) {
      webContents.send('terminal:exit', { id, exitCode });
    }
  });

  sessions.set(id, { pty, webContents, generation });
  return { id };
}

/**
 * Writes raw terminal input to an active session.
 *
 * @param id - Terminal tab id.
 * @param data - Bytes to send to the shell stdin.
 */
export function writeTerminal(id: string, data: string): void {
  const session = sessions.get(id);
  if (!session) {
    return;
  }

  session.pty.write(data);
}

/**
 * Resizes an active pseudo-terminal to match the renderer xterm viewport.
 *
 * @param id - Terminal tab id.
 * @param cols - New width in columns.
 * @param rows - New height in rows.
 */
export function resizeTerminal(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (!session) {
    return;
  }

  session.pty.resize(Math.max(cols, 2), Math.max(rows, 2));
}

/**
 * Kills one terminal session and removes it from the host map.
 *
 * @param id - Terminal tab id.
 */
export function killTerminal(id: string): void {
  const session = sessions.get(id);
  if (!session) {
    return;
  }

  sessions.delete(id);

  try {
    session.pty.kill();
  } catch {
    // Process may already be gone.
  }
}

/**
 * Kills every terminal owned by one renderer webContents, for example on window close.
 *
 * @param webContents - Renderer webContents whose sessions should be disposed.
 */
export function killTerminalsForWebContents(webContents: WebContents): void {
  for (const [id, session] of sessions) {
    if (session.webContents === webContents) {
      killTerminal(id);
    }
  }
}

/**
 * Kills all active terminal sessions during application shutdown.
 */
export function killAllTerminals(): void {
  for (const id of [...sessions.keys()]) {
    killTerminal(id);
  }
}
