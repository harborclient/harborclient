import { useEffect, useMemo, useRef, type JSX } from 'react';
import type { ScriptRef } from '#/shared/types';
import { SCRIPT_EDITOR_GROUP_HEADINGS, type ScriptEditorGroup } from '#/shared/scriptStage';
import {
  SCRIPT_GROUP_ENABLE_LABELS,
  scriptGroupEnabledState,
  scriptGroupHeadingDescription
} from './helpers';

interface Props {
  /**
   * Editor group whose heading and bulk-enable checkbox are rendered.
   */
  group: ScriptEditorGroup;

  /**
   * Active request stage tab used for Main-group help copy.
   */
  phase: 'pre' | 'post';

  /**
   * Scripts in the group used to derive checkbox checked/indeterminate state.
   */
  scripts: ScriptRef[];

  /**
   * Stable id referenced by the parent section `aria-labelledby`.
   */
  headingId: string;

  /**
   * Called when the bulk-enable checkbox toggles all scripts in the group.
   */
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * Renders a Before/Main/After heading with bulk-enable checkbox and help blurb.
 */
export function ScriptGroupHeading({
  group,
  phase,
  scripts,
  headingId,
  onEnabledChange
}: Props): JSX.Element {
  const checkboxRef = useRef<HTMLInputElement>(null);
  /**
   * Derives checked vs mixed enablement for the bulk checkbox from the group's rows.
   */
  const enabledState = useMemo(() => scriptGroupEnabledState(scripts), [scripts]);
  const checked = enabledState === 'all';
  const descriptionId = `${headingId}-description`;

  /**
   * Reflects mixed enablement across rows via the native indeterminate checkbox state.
   */
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = enabledState === 'mixed';
    }
  }, [enabledState]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          onChange={(event) => onEnabledChange(event.target.checked)}
          aria-label={SCRIPT_GROUP_ENABLE_LABELS[group]}
          aria-describedby={descriptionId}
          className="shrink-0"
        />
        <h3 id={headingId} className="m-0 mt-1 text-[14px] font-medium text-script-group-heading">
          {SCRIPT_EDITOR_GROUP_HEADINGS[group]}
        </h3>
      </div>
      <p id={descriptionId} className="m-0 text-[14px] text-muted">
        {scriptGroupHeadingDescription(group, phase)}
      </p>
    </div>
  );
}
