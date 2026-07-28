import { SidebarMethodBadge } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface Props {
  /**
   * HTTP method for the leading badge.
   */
  method: string;

  /**
   * Request display name.
   */
  name: string;

  /**
   * Optional URL shown under the name when not compact.
   */
  url?: string;

  /**
   * When true, hides the URL line to fit narrow blocks.
   */
  compact?: boolean;
}

/**
 * Request-styled timeline thumbnail using the sidebar method badge language.
 *
 * @param props - Method, name, and optional URL.
 * @returns Method badge + name (+ URL) thumbnail content.
 */
export function TimelineRequestThumbnail({
  method,
  name,
  url,
  compact = false
}: Props): JSX.Element {
  const showUrl = !compact && url != null && url.length > 0;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <SidebarMethodBadge method={method} uppercase />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium leading-tight">{name}</span>
        {showUrl ? (
          <span className="truncate text-[14px] leading-tight text-muted">{url}</span>
        ) : null}
      </span>
    </span>
  );
}
