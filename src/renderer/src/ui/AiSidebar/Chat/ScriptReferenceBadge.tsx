import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faCode } from '#/renderer/src/fontawesome';
import { SCRIPT_REFERENCE_BADGE_CLASS } from './scriptReferenceBadgeDom';

interface Props {
  /**
   * Resolved script display name shown inside the badge.
   */
  label: string;
}

/**
 * Inline badge showing the resolved name of a referenced request script.
 */
export function ScriptReferenceBadge({ label }: Props): JSX.Element {
  return (
    <span className={SCRIPT_REFERENCE_BADGE_CLASS} aria-hidden="true">
      <FaIcon icon={faCode} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
