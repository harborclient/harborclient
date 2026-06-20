import { useState, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { iconButton } from '#/renderer/src/ui/shared/classes';
import { CertificatesSidebar } from './CertificatesSidebar';
import { IdentitySection } from './IdentitySection';
import { TrustedKeysSection } from './TrustedKeysSection';
import type { CertificatesSection } from './types';

interface Props {
  /**
   * Closes the certificates view.
   */
  onClose: () => void;
}

/**
 * Full-area certificate management with sidebar navigation.
 */
export function Certificates({ onClose }: Props): JSX.Element {
  const [section, setSection] = useState<CertificatesSection>('identity');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">Certificates</h1>
        <button
          type="button"
          className={`${iconButton} opacity-100 text-[28px]`}
          title="Close"
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <CertificatesSidebar section={section} onSectionChange={setSection} />

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'identity' && <IdentitySection />}
          {section === 'trusted' && <TrustedKeysSection />}
        </div>
      </div>
    </div>
  );
}
