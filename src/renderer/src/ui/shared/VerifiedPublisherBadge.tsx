import { FaIcon } from '@harborclient/sdk/components';
import { faCircleCheck } from '#/renderer/src/fontawesome';
import type { JSX } from 'react';

/** Accessible name and tooltip for a plugin signed by a trusted publisher. */
const VERIFIED_AUTHOR_LABEL = 'Verified author';

/**
 * Success checkmark indicating a plugin was signed by a trusted publisher.
 *
 * Uses a programmatic label instead of an SVG title so screen readers reliably
 * announce verification status.
 */
export function VerifiedPublisherBadge(): JSX.Element {
  return (
    <span
      role="img"
      aria-label={VERIFIED_AUTHOR_LABEL}
      title={VERIFIED_AUTHOR_LABEL}
      className="inline-flex"
    >
      <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 shrink-0 text-success" />
    </span>
  );
}
