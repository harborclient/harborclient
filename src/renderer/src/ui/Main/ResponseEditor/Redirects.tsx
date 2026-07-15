import { StatusDot } from '@harborclient/sdk/components';
import { statusDotVariant } from '#/renderer/src/ui/shared/classes';
import type { RedirectHop } from '#/shared/types';
import type { JSX } from 'react';
import { getFinalRedirectUrl } from './redirectsDisplay';

interface Props {
  /**
   * Ordered redirect hops recorded while following 3xx responses.
   */
  redirects: RedirectHop[];
}

/**
 * Lists each redirect hop with method, status, source URL, and Location target.
 */
export function Redirects({ redirects }: Props): JSX.Element {
  const finalUrl = getFinalRedirectUrl(redirects);

  if (redirects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-[14px] text-muted">
        No redirects
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-separator">
      <ol className="list-none">
        {redirects.map((hop, index) => (
          <li
            key={`${hop.url}-${hop.status}-${index}`}
            className={`px-2.5 py-2 ${index > 0 ? 'border-t border-separator' : ''}`}
          >
            <div className="mb-1 flex items-center gap-2 text-[14px] font-medium text-text">
              <StatusDot variant={statusDotVariant(hop.status)} />
              <span>
                {hop.method}{' '}
                <span className="font-normal text-muted">
                  {hop.status} {hop.statusText}
                </span>
              </span>
            </div>
            <div className="break-words font-mono text-[14px] text-text-secondary">{hop.url}</div>
            <div className="mt-1 break-words text-[14px] text-muted" aria-hidden="true">
              →
            </div>
            <div className="break-words font-mono text-[14px] text-text">{hop.location}</div>
          </li>
        ))}
      </ol>
      {finalUrl && (
        <div className="border-t border-separator px-2.5 py-2">
          <div className="text-[14px] font-medium text-text">Final destination</div>
          <div className="break-words font-mono text-[14px] text-text-secondary">{finalUrl}</div>
        </div>
      )}
    </div>
  );
}
