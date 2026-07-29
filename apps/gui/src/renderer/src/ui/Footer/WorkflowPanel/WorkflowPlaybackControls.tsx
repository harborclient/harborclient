import { Button, FaIcon, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faArrowsRotate, faBackward, faForward, faPause, faPlay } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * True while the play loop is actively dispatching actions, or while recording.
   */
  playing: boolean;

  /**
   * Current 0-based action cursor.
   */
  actionIndex: number;

  /**
   * Total actions in the loaded workflow.
   */
  actionCount: number;

  /**
   * Pause between consecutive actions during playback, in milliseconds.
   */
  delayMs: number;

  /**
   * Starts or pauses automatic playback, or toggles recording in record mode.
   */
  onTogglePlay: () => void;

  /**
   * Moves the cursor one step backward without dispatching.
   */
  onRewind: () => void;

  /**
   * Moves the cursor one step forward without dispatching.
   */
  onFastForward: () => void;

  /**
   * Resets the cursor to #0 and clears elapsed playback time.
   */
  onRestart: () => void;

  /**
   * Updates the inter-step delay in milliseconds.
   *
   * @param delayMs - Next delay value.
   */
  onDelayMsChange: (delayMs: number) => void;

  /**
   * When true, the primary button is Record/Pause instead of Play/Pause and secondary
   * transport controls are hidden.
   */
  recordMode?: boolean;
}

/**
 * Transport controls for workflow playback or recording.
 *
 * @param props - Playback control props.
 * @returns Control row UI.
 */
export function WorkflowPlaybackControls({
  playing,
  actionIndex,
  actionCount,
  delayMs,
  onTogglePlay,
  onRewind,
  onFastForward,
  onRestart,
  onDelayMsChange,
  recordMode = false
}: Props): JSX.Element {
  const atStart = actionIndex <= 0;
  const atEnd = actionIndex >= actionCount;
  const canPlay = actionCount > 0 && !atEnd;

  /**
   * Parses and clamps the delay input value for the playback session.
   *
   * @param value - Raw input string from the delay field.
   */
  const handleDelayChange = (value: string): void => {
    onDelayMsChange(Math.max(0, Number(value) || 0));
  };

  if (recordMode) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          className="shrink-0 px-3"
          onClick={onTogglePlay}
          aria-pressed={playing}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <span
              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
              aria-hidden
            >
              {playing ? (
                <FaIcon icon={faPause} className="h-3.5 w-3.5" />
              ) : (
                <span className="inline-block h-3 w-3 rounded-full bg-danger" />
              )}
            </span>
            <span className="inline-grid justify-items-center">
              <span className="invisible col-start-1 row-start-1" aria-hidden>
                Record
              </span>
              <span className="col-start-1 row-start-1">{playing ? 'Pause' : 'Record'}</span>
            </span>
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 px-2"
        disabled={playing}
        onClick={onRestart}
        aria-label="Restart"
        title="Restart"
      >
        <FaIcon icon={faArrowsRotate} className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 px-2"
        disabled={playing || atStart}
        onClick={onRewind}
        aria-label="Rewind one action"
        title="Rewind one action"
      >
        <FaIcon icon={faBackward} className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="primary"
        className="shrink-0 px-3"
        disabled={!playing && !canPlay}
        onClick={onTogglePlay}
        aria-pressed={playing}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={playing ? faPause : faPlay} className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="inline-grid justify-items-center">
            <span className="invisible col-start-1 row-start-1" aria-hidden>
              Pause
            </span>
            <span className="col-start-1 row-start-1">{playing ? 'Pause' : 'Play'}</span>
          </span>
        </span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 px-2"
        disabled={playing || atEnd}
        onClick={onFastForward}
        aria-label="Fast forward one action"
        title="Fast forward one action"
      >
        <FaIcon icon={faForward} className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <label
        htmlFor="workflow-playback-delay"
        className="inline-flex shrink-0 items-center gap-1.5 text-[14px] text-muted"
      >
        <span className="sr-only">Delay between actions (ms)</span>
        <Input
          id="workflow-playback-delay"
          type="number"
          min={0}
          step={1000}
          className="w-20"
          value={delayMs}
          disabled={playing}
          title="Delay between actions (ms)"
          onChange={(event) => {
            handleDelayChange(event.target.value);
          }}
        />
        <span aria-hidden>ms</span>
      </label>
    </div>
  );
}
