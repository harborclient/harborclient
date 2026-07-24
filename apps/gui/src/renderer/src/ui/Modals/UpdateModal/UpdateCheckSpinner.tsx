import { Spinner, StatusMessage } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/**
 * Spinner shown while the update check request is in flight.
 */
export function UpdateCheckSpinner(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <Spinner size="md" label="Checking for updates" className="[&_svg]:h-8 [&_svg]:w-8" />
      <StatusMessage live={false}>Checking for updates...</StatusMessage>
    </div>
  );
}
