import { describe, expect, it } from 'vitest';
import { buildTimingRows, timingPercent } from './timingDisplay';

describe('buildTimingRows', () => {
  it('builds cumulative rows for all captured phases', () => {
    expect(
      buildTimingRows(
        {
          stalledMs: 10,
          connectMs: 20,
          requestSentMs: 5,
          waitingMs: 50,
          downloadMs: 30
        },
        115
      )
    ).toEqual([
      {
        id: 'stalled',
        group: 'Connection Start',
        label: 'Stalled',
        durationMs: 10,
        startMs: 0
      },
      {
        id: 'connect',
        group: 'Connection Start',
        label: 'Connect',
        durationMs: 20,
        startMs: 10
      },
      {
        id: 'requestSent',
        group: 'Request/Response',
        label: 'Request sent',
        durationMs: 5,
        startMs: 30
      },
      {
        id: 'waiting',
        group: 'Request/Response',
        label: 'Waiting for server response',
        durationMs: 50,
        startMs: 35
      },
      {
        id: 'download',
        group: 'Request/Response',
        label: 'Content download',
        durationMs: 30,
        startMs: 85
      }
    ]);
  });

  it('omits connect timing when a connection is reused', () => {
    expect(
      buildTimingRows(
        {
          stalledMs: 10,
          requestSentMs: 4,
          waitingMs: 30,
          downloadMs: 16
        },
        60
      )
    ).toEqual([
      {
        id: 'stalled',
        group: 'Connection Start',
        label: 'Stalled',
        durationMs: 10,
        startMs: 0
      },
      {
        id: 'requestSent',
        group: 'Request/Response',
        label: 'Request sent',
        durationMs: 4,
        startMs: 10
      },
      {
        id: 'waiting',
        group: 'Request/Response',
        label: 'Waiting for server response',
        durationMs: 30,
        startMs: 14
      },
      {
        id: 'download',
        group: 'Request/Response',
        label: 'Content download',
        durationMs: 16,
        startMs: 44
      }
    ]);
  });

  it('returns an empty list when timing is unavailable', () => {
    expect(buildTimingRows(undefined, 42)).toEqual([]);
  });
});

describe('timingPercent', () => {
  it('scales offsets against the total request duration', () => {
    expect(timingPercent(25, 100)).toBe(25);
    expect(timingPercent(150, 100)).toBe(100);
    expect(timingPercent(10, 0)).toBe(0);
  });
});
