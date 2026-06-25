import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import type { SettingsSection } from './types';

interface Props {
  /**
   * Currently selected settings section.
   */
  section: SettingsSection;

  /**
   * Sidebar entries including built-in and plugin sections.
   */
  sections: Array<{ value: SettingsSection; label: string; icon: IconDefinition }>;

  /**
   * Called when the user selects a different section.
   *
   * @param section - Newly selected section.
   */
  onSectionChange: (section: SettingsSection) => void;
}

/**
 * Narrow sidebar navigation for application settings sections.
 */
export function SettingsSidebar({ section, sections, onSectionChange }: Props): JSX.Element {
  return (
    <nav
      className="flex w-[180px] shrink-0 flex-col gap-0.5 border-r border-separator bg-sidebar px-2 py-3"
      aria-label="Settings sections"
    >
      {sections.map((item) => {
        const active = section === item.value;
        return (
          <button
            key={item.value}
            type="button"
            className={`${sourceRow(active)} w-full gap-2 border-none text-left text-[14px] app-no-drag`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSectionChange(item.value)}
          >
            <FaIcon
              icon={item.icon}
              className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-text' : 'text-muted'}`}
            />
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
