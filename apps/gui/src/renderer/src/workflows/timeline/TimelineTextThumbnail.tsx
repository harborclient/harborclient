import { FaIcon } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX } from 'react';

interface Props {
  /**
   * Leading icon for the action type.
   */
  icon: IconDefinition;

  /**
   * Primary label (verb or entity name).
   */
  title: string;

  /**
   * Optional secondary line; omitted when compact.
   */
  subtitle?: string;

  /**
   * When true, hides the subtitle to fit narrow blocks.
   */
  compact?: boolean;
}

/**
 * Stock timeline thumbnail for simple text actions (tabs, pages, send, etc.).
 *
 * @param props - Icon, title, and optional subtitle.
 * @returns Compact icon + text thumbnail content.
 */
export function TimelineTextThumbnail({
  icon,
  title,
  subtitle,
  compact = false
}: Props): JSX.Element {
  const showSubtitle = !compact && subtitle != null && subtitle.length > 0;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <FaIcon icon={icon} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium leading-tight">{title}</span>
        {showSubtitle ? (
          <span className="truncate text-[14px] leading-tight text-muted">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
