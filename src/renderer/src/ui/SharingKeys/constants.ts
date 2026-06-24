import type { SharingKeysSection } from './types';

export const SHARING_KEYS_SECTIONS: Array<{ value: SharingKeysSection; label: string }> = [
  { value: 'identity', label: 'My identity' },
  { value: 'trusted', label: 'Trusted keys' }
];
