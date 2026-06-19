import { useState, type JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { iconButton } from '#/renderer/src/ui/classes';
import { FirestoreSection } from './FirestoreSection';
import { GeneralSection } from './GeneralSection';
import { SettingsSidebar } from './SettingsSidebar';
import { SqliteSection } from './SqliteSection';
import type { SettingsSection } from './types';

interface Props {
  /**
   * Closes the settings view.
   */
  onClose: () => void;
}

/**
 * Full-area application settings with sidebar navigation.
 */
export function Settings({ onClose }: Props): JSX.Element {
  const [section, setSection] = useState<SettingsSection>('general');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">Settings</h1>
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
        <SettingsSidebar section={section} onSectionChange={setSection} />

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'general' && <GeneralSection />}
          {section === 'sqlite' && <SqliteSection />}
          {section === 'firestore' && <FirestoreSection />}
        </div>
      </div>
    </div>
  );
}
