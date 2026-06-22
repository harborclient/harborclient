import { useState, type JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { AiSection } from './AiSection';
import { DatabasesSection } from './DatabasesSection';
import { GeneralSection } from './GeneralSection';
import { ProxySection } from './ProxySection';
import { ShortcutsSection } from './ShortcutsSection';
import { SyntaxHighlightingSection } from './SyntaxHighlightingSection';
import { SettingsSidebar } from './SettingsSidebar';
import type { SettingsSection } from './types';

interface Props {
  /**
   * Closes the settings view.
   */
  onClose: () => void;

  /**
   * Settings section to show when the overlay opens.
   */
  initialSection: SettingsSection;
}

/**
 * Full-area application settings with sidebar navigation.
 */
export function Settings({ onClose, initialSection }: Props): JSX.Element {
  const [section, setSection] = useState<SettingsSection>(initialSection);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">Settings</h1>
        <Button
          type="button"
          variant="icon"
          className="opacity-100 text-[28px]"
          title="Close"
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <SettingsSidebar section={section} onSectionChange={setSection} />

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'general' && <GeneralSection />}
          {section === 'syntax' && <SyntaxHighlightingSection />}
          {section === 'shortcuts' && <ShortcutsSection />}
          {section === 'proxy' && <ProxySection />}
          {section === 'databases' && <DatabasesSection />}
          {section === 'ai' && <AiSection />}
        </div>
      </div>
    </div>
  );
}
