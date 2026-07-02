import { FaIcon } from '@harborclient/sdk/components';
import { faCircleCheck } from '#/renderer/src/fontawesome';
import type { JSX } from 'react';
import { verifiedPublisherAriaLabel } from '#/renderer/src/ui/shared/verifiedPublisherBadge';

interface Props {
  /**
   * Publisher name shown in the verification badge label.
   */
  author: string | undefined;
}

/**
 * Success checkmark indicating a plugin was signed by a trusted publisher.
 *
 * Uses a programmatic label instead of an SVG title so screen readers reliably
 * announce verification status.
 */
export function VerifiedPublisherBadge({ author }: Props): JSX.Element {
  return (
    <span role="img" aria-label={verifiedPublisherAriaLabel(author)} className="inline-flex">
      <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 shrink-0 text-success" />
    </span>
  );
}
