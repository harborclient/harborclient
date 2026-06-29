import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import { IdentitySection } from './IdentitySection';
import { TrustedKeysSection } from './TrustedKeysSection';
import { SHARING_KEYS_SECTIONS } from './constants';
import type { SharingKeysSection } from './types';

interface Props {
  /**
   * Closes the sharing keys view.
   */
  onClose: () => void;
}

/**
 * Full-area sharing key management with sidebar navigation.
 */
export function SharingKeys({ onClose }: Props): JSX.Element {
  const [section, setSection] = useState<SharingKeysSection>('identity');

  return (
    <SidebarLayout
      sidebar={
        <PageSidebar
          ariaLabel="Sharing keys sections"
          selected={section}
          onSelect={setSection}
          items={SHARING_KEYS_SECTIONS}
        />
      }
    >
      {section === 'identity' && <IdentitySection onClose={onClose} />}
      {section === 'trusted' && <TrustedKeysSection onClose={onClose} />}
    </SidebarLayout>
  );
}
