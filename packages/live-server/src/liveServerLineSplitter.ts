/**
 * Incremental newline splitter for child-process stdout/stderr chunks.
 */
export interface LiveServerLineSplitter {
  /**
   * Accepts a UTF-8 chunk and emits complete lines (without trailing newlines).
   *
   * @param chunk - Raw text from the child process.
   */
  push: (chunk: string) => void;

  /**
   * Emits any remaining buffered text that lacked a trailing newline.
   */
  flush: () => void;
}

/**
 * Creates a line splitter that forwards non-empty lines to `onLine`.
 *
 * Handles `\n` and `\r\n`. Empty lines (consecutive newlines) are skipped.
 *
 * @param onLine - Called once per complete non-empty line.
 * @returns Splitter with push/flush controls.
 */
export function createLiveServerLineSplitter(
  onLine: (line: string) => void
): LiveServerLineSplitter {
  let pending = '';

  return {
    /**
     * Buffers `chunk` and emits every complete line found so far.
     *
     * @param chunk - UTF-8 text fragment from stdout or stderr.
     */
    push(chunk: string): void {
      pending += chunk;
      const parts = pending.split(/\r?\n/);
      pending = parts.pop() ?? '';
      for (const line of parts) {
        if (line !== '') {
          onLine(line);
        }
      }
    },

    /**
     * Emits leftover text when the stream ends without a final newline.
     */
    flush(): void {
      if (pending !== '') {
        onLine(pending);
        pending = '';
      }
    }
  };
}
