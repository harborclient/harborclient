import { BackButton } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface Props {
  /**
   * Closes the settings overlay and returns to the request editor.
   */
  onClose: () => void;
}

/**
 * Labeled back control for settings section headers.
 */
export function SettingsBackButton({ onClose }: Props): JSX.Element {
  return <BackButton onClick={onClose} ariaLabel="Back to requests" />;
}
