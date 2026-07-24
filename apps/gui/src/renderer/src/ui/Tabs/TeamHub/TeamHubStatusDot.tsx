import { StatusDot } from '@harborclient/sdk/components';
import { type JSX } from 'react';

interface Props {
  /**
   * When true, the hub health probe succeeded and storage is available.
   */
  online: boolean;

  /**
   * When true, the hub service scan is still running.
   */
  scanning: boolean;
}

/**
 * Returns the accessible status label for a team hub connectivity dot.
 *
 * @param online - Whether the hub passed the health and session probe.
 * @param scanning - Whether the service scan is still in flight.
 */
function teamHubStatusLabel(online: boolean, scanning: boolean): string {
  if (scanning) {
    return 'Scanning';
  }

  return online ? 'Online' : 'Offline';
}

/**
 * Renders a colored connectivity dot with tooltip and accessible name for one team hub.
 */
export function TeamHubStatusDot({ online, scanning }: Props): JSX.Element {
  const label = teamHubStatusLabel(online, scanning);

  return (
    <StatusDot variant={online && !scanning ? 'success' : 'muted'} label={label} title={label} />
  );
}
