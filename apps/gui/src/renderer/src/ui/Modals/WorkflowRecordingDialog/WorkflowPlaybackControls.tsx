import { Button, FaIcon, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faArrowsRotate, faBackward, faForward, faPlay, faStop } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * True while the play loop is actively dispatching actions.
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
   * Starts or stops automatic playback.
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
   * When true, lays out controls in a single horizontal row for the wide play dialog.
   */
  compact?: boolean;
}

/**
 * Transport controls for workflow playback (rewind, play/stop, fast-forward, delay, restart).
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
  compact = false
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

  const delayField = (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-[14px] text-muted">
      <Input
        id="workflow-playback-delay"
        type="number"
        min={0}
        step={1}
        className="w-20"
        value={delayMs}
        disabled={playing}
        aria-label="Delay between actions (ms)"
        onChange={(event) => {
          handleDelayChange(event.target.value);
        }}
      />
      <span aria-hidden>ms</span>
    </label>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-2"
          disabled={playing || atStart}
          onClick={onRewind}
          aria-label="Rewind one action"
        >
          <FaIcon icon={faBackward} className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant={playing ? 'primaryDanger' : 'primary'}
          className="shrink-0 px-3"
          disabled={!playing && !canPlay}
          onClick={onTogglePlay}
          aria-pressed={playing}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <FaIcon icon={playing ? faStop : faPlay} className="h-3.5 w-3.5" aria-hidden />
            {playing ? 'Stop' : 'Play'}
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-2"
          disabled={playing || atEnd}
          onClick={onFastForward}
          aria-label="Fast forward one action"
        >
          <FaIcon icon={faForward} className="h-3.5 w-3.5" aria-hidden />
        </Button>
        {delayField}
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-2"
          disabled={playing}
          onClick={onRestart}
          aria-label="Restart"
        >
          <FaIcon icon={faArrowsRotate} className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-2"
          disabled={playing || atStart}
          onClick={onRewind}
          aria-label="Rewind one action"
        >
          <FaIcon icon={faBackward} className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant={playing ? 'primaryDanger' : 'primary'}
          className="flex-1"
          disabled={!playing && !canPlay}
          onClick={onTogglePlay}
          aria-pressed={playing}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <FaIcon icon={playing ? faStop : faPlay} className="h-3.5 w-3.5" aria-hidden />
            {playing ? 'Stop' : 'Play'}
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-2"
          disabled={playing || atEnd}
          onClick={onFastForward}
          aria-label="Fast forward one action"
        >
          <FaIcon icon={faForward} className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {delayField}
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={playing}
          onClick={onRestart}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <FaIcon icon={faArrowsRotate} className="h-3.5 w-3.5" aria-hidden />
            Restart
          </span>
        </Button>
      </div>
    </div>
  );
}
