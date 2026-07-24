import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faFingerprint, faUserShield } from '#/renderer/src/fontawesome';
import type { SharingKeysSection } from './types';

/**
 * Sidebar navigation entries for the Sharing Keys screen (order, labels, and icons).
 */
export const SHARING_KEYS_SECTIONS: Array<{
  value: SharingKeysSection;
  label: string;
  icon: IconDefinition;
}> = [
  { value: 'identity', label: 'My identity', icon: faFingerprint },
  { value: 'trusted', label: 'Trusted keys', icon: faUserShield }
];
