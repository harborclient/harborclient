import { describe, expect, it } from 'vitest';
import { buildActiveTurnPresentationProps } from './activeTurnPresentationModel';
import { liveTurnScrollKey, buildLiveTurnScrollSnapshot } from './liveTurnScrollKey';
import { toolRowOwnerLabel, toolRowStatusLabel } from './toolRowPresentation';

describe('toolRowPresentation', () => {
  it('maps tool owners and statuses to readable labels', () => {
    expect(toolRowOwnerLabel('harbor')).toBe('Desktop');
    expect(toolRowOwnerLabel('hub')).toBe('Team Hub');
    expect(toolRowStatusLabel('running')).toBe('Running');
    expect(toolRowStatusLabel('error')).toBe('Error');
  });
});

describe('buildActiveTurnPresentationProps', () => {
  it('prefers the active turn over handoff markdown', () => {
    const props = buildActiveTurnPresentationProps(
      {
        turnId: 'turn-1',
        phase: 'streaming',
        text: 'Live',
        thought: 'hmm',
        toolRows: [],
        stepIndex: 0,
        stepMessages: []
      },
      { text: 'Handoff' }
    );

    expect(props?.text).toBe('Live');
    expect(props?.thought).toBe('hmm');
  });

  it('builds handoff-only presentation after turn.end', () => {
    const props = buildActiveTurnPresentationProps(undefined, { text: 'Handoff' });

    expect(props).toEqual({
      text: 'Handoff',
      thought: '',
      toolRows: [],
      phase: 'idle'
    });
  });

  it('returns null when no live presentation exists', () => {
    expect(buildActiveTurnPresentationProps(undefined, undefined)).toBeNull();
  });
});

describe('liveTurnScrollKey', () => {
  it('changes when streamed text grows', () => {
    const before = liveTurnScrollKey(
      buildLiveTurnScrollSnapshot(
        {
          turnId: 'turn-1',
          phase: 'streaming',
          text: 'Hi',
          thought: '',
          toolRows: [],
          stepIndex: 0,
          stepMessages: []
        },
        undefined
      )
    );
    const after = liveTurnScrollKey(
      buildLiveTurnScrollSnapshot(
        {
          turnId: 'turn-1',
          phase: 'streaming',
          text: 'Hello',
          thought: '',
          toolRows: [],
          stepIndex: 0,
          stepMessages: []
        },
        undefined
      )
    );

    expect(before).not.toBe(after);
  });
});
