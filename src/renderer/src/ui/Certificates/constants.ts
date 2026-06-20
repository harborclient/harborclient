import type { CertificatesSection } from './types';

export const CERTIFICATES_SECTIONS: Array<{ value: CertificatesSection; label: string }> = [
  { value: 'identity', label: 'My identity' },
  { value: 'trusted', label: 'Trusted keys' }
];
