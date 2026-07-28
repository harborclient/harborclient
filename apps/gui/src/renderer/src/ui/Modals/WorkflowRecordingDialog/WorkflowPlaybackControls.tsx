import { Button, FaIcon } from '@harborclient/sdk/components';
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
}

/**
 * Transport controls for workflow playback (rewind, play/stop, fast-forward, restart).
 *
 * @param props - Playback control props.
 * @returns Control row UI.
 */
export function WorkflowPlaybackControls({
  playing,
  actionIndex,
  actionCount,
  onTogglePlay,
  onRewind,
  onFastForward,
  onRestart
}: Props): JSX.Element {
  const atStart = actionIndex <= 0;
  const atEnd = actionIndex >= actionCount;
  const canPlay = actionCount > 0 && !atEnd;

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
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={playing}
        onClick={onRestart}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <FaIcon icon={faArrowsRotate} className="h-3.5 w-3.5" aria-hidden />
          Restart
        </span>
      </Button>
    </div>
  );
}
