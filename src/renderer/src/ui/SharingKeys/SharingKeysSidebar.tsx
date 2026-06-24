import type { JSX } from 'react';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import { SHARING_KEYS_SECTIONS } from './constants';
import type { SharingKeysSection } from './types';

interface Props {
  /**
   * Currently selected sharing keys section.
   */
  section: SharingKeysSection;

  /**
   * Called when the user selects a different section.
   *
   * @param section - Newly selected section.
   */
  onSectionChange: (section: SharingKeysSection) => void;
}

/**
 * Narrow sidebar navigation for sharing key management sections.
 */
export function SharingKeysSidebar({ section, onSectionChange }: Props): JSX.Element {
  return (
    <nav
      className="flex w-[180px] shrink-0 flex-col gap-0.5 border-r border-separator bg-sidebar px-2 py-3"
      aria-label="Sharing keys sections"
    >
      {SHARING_KEYS_SECTIONS.map((item) => {
        const active = section === item.value;
        return (
          <button
            key={item.value}
            type="button"
            className={`${sourceRow(active)} w-full border-none text-left text-[14px] app-no-drag`}
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
