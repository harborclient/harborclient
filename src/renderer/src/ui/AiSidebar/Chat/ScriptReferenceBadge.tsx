import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faCode } from '#/renderer/src/fontawesome';
import {
  getScriptReferenceBadgeClass,
  type ScriptReferenceBadgeVariant
} from './scriptReferenceBadgeDom';

interface Props {
  /**
   * Resolved script display name shown inside the badge.
   */
  label: string;

  /**
   * Visual treatment for neutral surfaces or solid accent user bubbles.
   */
  variant?: ScriptReferenceBadgeVariant;
}

/**
 * Inline badge showing the resolved name of a referenced request script.
 */
export function ScriptReferenceBadge({ label, variant = 'default' }: Props): JSX.Element {
  return (
    <span className={getScriptReferenceBadgeClass(variant)} aria-hidden="true">
      <FaIcon icon={faCode} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
