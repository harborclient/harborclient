import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import { IdentitySection } from './IdentitySection';
import { TrustedKeysSection } from './TrustedKeysSection';
import { SHARING_KEYS_SECTIONS } from './constants';
import type { SharingKeysSection } from './types';

/**
 * Full-area sharing key management with sidebar navigation.
 */
export function SharingKeys(): JSX.Element {
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
      {section === 'identity' && <IdentitySection />}
      {section === 'trusted' && <TrustedKeysSection />}
    </SidebarLayout>
  );
}
