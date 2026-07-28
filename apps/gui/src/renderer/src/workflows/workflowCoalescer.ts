import type { WorkflowEvent } from './workflowEventTypes';

/**
 * Buffers consecutive workflow events that share a coalesce key so draft-style
 * bursts collapse to a single last-write-wins record.
 */
export class WorkflowCoalescer {
  #buffered: WorkflowEvent | null = null;
  #bufferedKey: string | null = null;

  /**
   * Returns the event currently held in the buffer, if any.
   *
   * @returns Buffered event, or null when empty.
   */
  peek(): WorkflowEvent | null {
    return this.#buffered;
  }

  /**
   * Returns the coalesce key for the buffered event, if any.
   *
   * @returns Buffered key, or null when empty.
   */
  peekKey(): string | null {
    return this.#bufferedKey;
  }

  /**
   * Accepts a candidate event. When the key matches the buffer, replaces the
   * buffer and returns null. Otherwise flushes the previous buffer (if any) and
   * starts a new buffer with the candidate.
   *
   * @param event - Candidate event to buffer.
   * @param key - Coalesce key for this candidate.
   * @returns Previously buffered event that must be flushed, or null.
   */
  push(event: WorkflowEvent, key: string): WorkflowEvent | null {
    if (this.#buffered != null && this.#bufferedKey === key) {
      this.#buffered = event;
      return null;
    }

    const flushed = this.#buffered;
    this.#buffered = event;
    this.#bufferedKey = key;
    return flushed;
  }

  /**
   * Empties the buffer and returns the held event, if any.
   *
   * @returns Flushed event, or null when the buffer was empty.
   */
  flush(): WorkflowEvent | null {
    const flushed = this.#buffered;
    this.#buffered = null;
    this.#bufferedKey = null;
    return flushed;
  }
}
