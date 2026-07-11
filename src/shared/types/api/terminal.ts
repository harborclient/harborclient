/**
 * Input for spawning a footer terminal pseudo-terminal session.
 */
export interface CreateTerminalInput {
  /**
   * Stable tab id shared with Redux and persistence.
   */
  id: string;

  /**
   * Working directory; blank values use the user home directory in the main process.
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
 * Result returned after a terminal session is created.
 */
export interface CreateTerminalResult {
  /**
   * Session id matching the requested tab id.
   */
  id: string;
}

/**
 * Payload streamed from the main process when shell output is available.
 */
export interface TerminalDataEvent {
  /**
   * Terminal tab id.
   */
  id: string;

  /**
   * Raw ANSI output from the pseudo-terminal.
   */
  data: string;
}

/**
 * Payload streamed when a shell process exits.
 */
export interface TerminalExitEvent {
  /**
   * Terminal tab id.
   */
  id: string;

  /**
   * Process exit code, or null when unavailable.
   */
  exitCode: number | null;
}

/**
 * IPC methods for footer terminal sessions.
 */
export interface ApiTerminal {
  /**
   * Spawns a shell in a pseudo-terminal owned by the calling renderer.
   *
   * @param input - Tab id, optional cwd, and initial terminal dimensions.
   */
  createTerminal: (input: CreateTerminalInput) => Promise<CreateTerminalResult>;

  /**
   * Sends raw input to an active terminal session.
   *
   * @param id - Terminal tab id.
   * @param data - Bytes to write to shell stdin.
   */
  writeTerminal: (id: string, data: string) => void;

  /**
   * Resizes an active terminal session.
   *
   * @param id - Terminal tab id.
   * @param cols - New width in columns.
   * @param rows - New height in rows.
   */
  resizeTerminal: (id: string, cols: number, rows: number) => void;

  /**
   * Kills one terminal session.
   *
   * @param id - Terminal tab id.
   */
  killTerminal: (id: string) => Promise<void>;

  /**
   * Subscribes to streamed terminal output from the main process.
   *
   * @param callback - Handler invoked for each output chunk.
   */
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;

  /**
   * Subscribes to shell exit notifications from the main process.
   *
   * @param callback - Handler invoked when a shell process exits.
   */
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => () => void;
}
