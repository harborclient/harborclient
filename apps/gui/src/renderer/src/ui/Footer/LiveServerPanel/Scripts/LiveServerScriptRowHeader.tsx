import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH } from '@harborclient/core/types';
import { SCRIPT_ROW_TITLE_CLASS } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/constants';
import { stopDragPointerDown } from '#/renderer/src/ui/Shared/Script/ScriptListEditor/helpers';

interface Props {
  /**
   * Path-match pattern bound to the row (e.g. `index.html`, `/api/*`).
   */
  matchPath: string;

  /**
   * Accessible label for the script row (used in the input `aria-label`).
   */
  scriptLabel: string;

  /**
   * Called when the user edits the match-path field.
   *
   * @param matchPath - Raw field value (normalized on save).
   */
  onMatchPathChange: (matchPath: string) => void;
}

/**
 * Path-match input shown in place of the script name for live-server script rows.
 *
 * Scripts only run when the incoming request path matches this pattern.
 */
export function LiveServerScriptRowHeader({
  matchPath,
  scriptLabel,
  onMatchPathChange
}: Props): JSX.Element {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${SCRIPT_ROW_TITLE_CLASS}`}>
      <Input
        variant="plain"
        className={`min-w-0 flex-1 border-none bg-transparent p-0 ${SCRIPT_ROW_TITLE_CLASS} outline-none app-no-drag`}
        type="text"
        value={matchPath}
        onChange={(event) => onMatchPathChange(event.target.value)}
        onPointerDown={stopDragPointerDown}
        aria-label={`Matching path for ${scriptLabel}`}
        placeholder={DEFAULT_LIVE_SERVER_SCRIPT_MATCH_PATH}
      />
    </div>
  );
}
