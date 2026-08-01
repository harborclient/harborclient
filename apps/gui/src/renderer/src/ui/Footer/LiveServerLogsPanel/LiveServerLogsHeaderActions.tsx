import { RoundButton } from '@harborclient/sdk/components';
import type { LiveServerLogsPlacement } from '@harborclient/core/types';
import { type JSX } from 'react';
import { faEraser, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { LiveServerLogsDockButton } from './LiveServerLogsDockButton';

interface Props {
  /**
   * Whether AI chat is available for whole-log `@logs` references.
   */
  aiAvailable: boolean;

  /**
   * Saved live server uuid used for AI chat references, when known.
   */
  liveServerUuid: string | null;

  /**
   * Whether Clear is enabled (buffer has lines).
   */
  canClear: boolean;

  /**
   * Current dock placement for the dock toggle control.
   */
  placement: LiveServerLogsPlacement;

  /**
   * Opens AI chat with a whole-log reference.
   */
  onAddLogsToChat: () => void;

  /**
   * Clears the selected session log buffer.
   */
  onClear: () => void;

  /**
   * Toggles footer ↔ sidebar dock placement.
   */
  onTogglePlacement: () => void;
}

/**
 * Shared live-server logs header actions: optional AI, Clear, and dock toggle.
 *
 * The host chrome appends its own close control after these buttons.
 *
 * @param props - Action availability and handlers.
 * @returns Ordered header action buttons.
 */
export function LiveServerLogsHeaderActions({
  aiAvailable,
  liveServerUuid,
  canClear,
  placement,
  onAddLogsToChat,
  onClear,
  onTogglePlacement
}: Props): JSX.Element {
  return (
    <>
      {aiAvailable && liveServerUuid != null ? (
        <RoundButton
          icon={faWandMagicSparkles}
          onClick={onAddLogsToChat}
          title="Add logs to chat"
          ariaLabel="Add logs to chat"
        />
      ) : null}
      <RoundButton
        icon={faEraser}
        onClick={onClear}
        title="Clear"
        ariaLabel="Clear live server logs"
        disabled={!canClear}
      />
      <LiveServerLogsDockButton placement={placement} onToggle={onTogglePlacement} />
    </>
  );
}
