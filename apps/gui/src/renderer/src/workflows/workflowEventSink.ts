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
   */
  append(event: WorkflowEvent): void {
    this.#events.push(event);
    if (this.#events.length > this.#capacity) {
      this.#events = this.#events.slice(this.#events.length - this.#capacity);
    }
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
