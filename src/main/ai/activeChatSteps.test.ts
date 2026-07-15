import { describe, expect, it } from 'vitest';
import {
  cancelActiveChatStep,
  trackActiveChatStep,
  untrackActiveChatStep
} from './activeChatSteps';

describe('activeChatSteps', () => {
  it('tracks and cancels an in-flight step', () => {
    const controller = new AbortController();
    trackActiveChatStep('step-1', controller);

    cancelActiveChatStep('step-1');

    expect(controller.signal.aborted).toBe(true);
  });

  it('no-ops cancel when the step id is unknown', () => {
    expect(() => cancelActiveChatStep('missing')).not.toThrow();
  });

  it('untracks only when the controller still owns the entry', () => {
    const first = new AbortController();
    const second = new AbortController();
    trackActiveChatStep('step-1', first);
    trackActiveChatStep('step-1', second);

    untrackActiveChatStep('step-1', first);

    cancelActiveChatStep('step-1');
    expect(second.signal.aborted).toBe(true);
  });
});
