import type { BrowserSecurityState } from '@harborclient/core/types';
import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faLock, faUnlock } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Committed guest TLS / scheme security from navigation updates.
   */
  securityState: BrowserSecurityState;
}

/**
 * Address-bar lock/unlock indicator for the webpage tab omnibox.
 *
 * Renders nothing for {@link BrowserSecurityState} `unknown` (e.g. `about:blank`).
 *
 * @param props - Component props.
 * @returns Security icon, or null when there is nothing to show.
 */
export function BrowserAddressSecurityIcon({ securityState }: Props): JSX.Element | null {
  if (securityState === 'unknown') {
    return null;
  }

  if (securityState === 'secure') {
    return (
      <span className="flex shrink-0 items-center leading-none" aria-label="Secure connection">
        <FaIcon icon={faLock} className="block h-4 w-4 text-method-get" />
      </span>
    );
  }

  if (securityState === 'invalid-cert') {
    return (
      <span className="flex shrink-0 items-center leading-none" aria-label="Certificate error">
        <FaIcon icon={faLock} className="block h-4 w-4 text-method-delete" />
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center leading-none" aria-label="Not secure">
      <FaIcon icon={faUnlock} className="block h-4 w-4 text-muted" />
    </span>
  );
}
