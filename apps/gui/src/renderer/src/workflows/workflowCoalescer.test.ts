import { describe, expect, it } from 'vitest';
import { WorkflowCoalescer } from './workflowCoalescer';
import type { WorkflowEvent } from './workflowEventTypes';

/**
 * Builds a minimal workflow event for coalescer tests.
 *
 * @param type - Logical event type.
 * @param payload - Event payload.
 * @returns Workflow event.
 */
function makeEvent(type: string, payload: unknown = null): WorkflowEvent {
  return { uuid: `event-${type}`, type, at: 1, payload };
}

describe('WorkflowCoalescer', () => {
  it('replaces the buffer when consecutive keys match', () => {
    const coalescer = new WorkflowCoalescer();
    expect(coalescer.push(makeEvent('request.draft', { n: 1 }), 'request.draft')).toBeNull();
    expect(coalescer.push(makeEvent('request.draft', { n: 2 }), 'request.draft')).toBeNull();
    expect(coalescer.peek()?.payload).toEqual({ n: 2 });
  });

  it('flushes the previous buffer when the key changes', () => {
    const coalescer = new WorkflowCoalescer();
    coalescer.push(makeEvent('request.draft', { n: 1 }), 'request.draft');
    const flushed = coalescer.push(makeEvent('request.send'), 'request.send');
    expect(flushed?.payload).toEqual({ n: 1 });
    expect(coalescer.peek()?.type).toBe('request.send');
  });

  it('flush returns and clears the buffered event', () => {
    const coalescer = new WorkflowCoalescer();
    coalescer.push(makeEvent('request.send'), 'request.send');
    expect(coalescer.flush()?.type).toBe('request.send');
    expect(coalescer.peek()).toBeNull();
    expect(coalescer.flush()).toBeNull();
  });
});
