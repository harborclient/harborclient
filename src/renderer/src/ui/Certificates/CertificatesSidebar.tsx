import type { JSX } from 'react';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import { CERTIFICATES_SECTIONS } from './constants';
import type { CertificatesSection } from './types';

interface Props {
  /**
   * Currently selected certificates section.
   */
  section: CertificatesSection;

  /**
   * Called when the user selects a different section.
   *
   * @param section - Newly selected section.
   */
  onSectionChange: (section: CertificatesSection) => void;
}

/**
 * Narrow sidebar navigation for certificate management sections.
 */
export function CertificatesSidebar({ section, onSectionChange }: Props): JSX.Element {
  return (
    <nav
      className="flex w-[180px] shrink-0 flex-col gap-0.5 border-r border-separator bg-sidebar px-2 py-3"
      aria-label="Certificates sections"
    >
      {CERTIFICATES_SECTIONS.map((item) => {
        const active = section === item.value;
        return (
          <button
            key={item.value}
            type="button"
            className={`${sourceRow(active)} w-full border-none text-left text-[13px] app-no-drag`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSectionChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
