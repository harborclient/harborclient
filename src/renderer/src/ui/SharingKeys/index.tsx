import { PageSidebar, SidebarLayout } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { usePersistedPageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection';
import { IdentitySection } from './IdentitySection';
import { TrustedKeysSection } from './TrustedKeysSection';
import { SHARING_KEYS_SECTIONS } from './constants';
import type { SharingKeysSection } from './types';

/**
 * Full-area sharing key management with sidebar navigation.
 */
export function SharingKeys(): JSX.Element {
  /**
   * Validates sidebar section ids for the sharing keys screen.
   */
  const isValidSection = useCallback(
    (candidate: string): candidate is SharingKeysSection =>
      SHARING_KEYS_SECTIONS.some((entry) => entry.value === candidate),
    []
  );

  const { section, setSection } = usePersistedPageSidebarSection<SharingKeysSection>({
    pageKey: 'sharing-keys',
    defaultSection: 'identity',
    isValidSection
  });

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
