import type { WorkflowEvent } from './workflowEventTypes';

/** Maximum number of flushed events retained in memory. */
const DEFAULT_CAPACITY = 200;

type Listener = (events: readonly WorkflowEvent[]) => void;

/**
 * Ring-buffer sink for flushed workflow events.
 */
export class WorkflowEventSink {
  readonly #capacity: number;
  readonly #listeners = new Set<Listener>();
  #events: WorkflowEvent[] = [];

  /**
   * Creates a sink with a fixed capacity.
   *
   * @param capacity - Maximum retained events; oldest are dropped first.
   */
  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.#capacity = capacity;
  }

  /**
   * Returns a shallow copy of the retained events in append order.
   *
   * @returns Copied event list.
   */
  getEvents(): WorkflowEvent[] {
    return [...this.#events];
  }

  /**
   * Appends an event, evicting the oldest entry when over capacity.
   *
   * @param event - Flushed workflow event to retain.
   * @returns Number of oldest events dropped to stay within capacity.
   */
  append(event: WorkflowEvent): number {
    this.#events.push(event);
    let dropped = 0;
    if (this.#events.length > this.#capacity) {
      dropped = this.#events.length - this.#capacity;
      this.#events = this.#events.slice(dropped);
    }
    this.#notify();
    return dropped;
  }

  /**
   * Keeps events through `indexInclusive` and drops everything after.
   *
   * @param indexInclusive - Last index to retain; negative clears the sink.
   */
  truncateTo(indexInclusive: number): void {
    const next = indexInclusive < 0 ? [] : this.#events.slice(0, Math.floor(indexInclusive) + 1);
    if (next.length === this.#events.length) {
      return;
    }
    this.#events = next;
    this.#notify();
  }

  /**
   * Replaces the entire event list, trimming to capacity from the end.
   *
   * @param events - New ordered events to retain.
   */
  replaceAll(events: readonly WorkflowEvent[]): void {
    const copy = [...events];
    this.#events = copy.length > this.#capacity ? copy.slice(copy.length - this.#capacity) : copy;
    this.#notify();
  }

  /**
   * Removes all retained events.
   */
  clear(): void {
    if (this.#events.length === 0) {
      return;
    }
    this.#events = [];
    this.#notify();
  }

  /**
   * Subscribes to sink mutations (append / clear).
   *
   * @param listener - Called with the current event list after each change.
   * @returns Unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notifies all listeners with a fresh copy of the event list.
   */
  #notify(): void {
    const snapshot = this.getEvents();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}
