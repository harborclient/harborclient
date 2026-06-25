import { useMemo, useState, type JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faPuzzlePiece, faXmark } from '#/renderer/src/fontawesome';
import { usePluginSettingsSections } from '#/renderer/src/plugins/pluginHooks';
import { AiSection } from './AiSection';
import { BackupRestoreSection } from './BackupRestoreSection';
import { StorageLocationsSection } from './StorageLocationsSection';
import { GeneralSection } from './GeneralSection';
import { PluginsSection } from './PluginsSection';
import { ProxySection } from './ProxySection';
import { ShortcutsSection } from './ShortcutsSection';
import { SyntaxHighlightingSection } from './SyntaxHighlightingSection';
import { SettingsSidebar } from './SettingsSidebar';
import { SETTINGS_SECTIONS } from './constants';
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
 * Renders the panel for the active built-in or plugin settings section.
 *
 * @param section - Selected settings section id.
 * @param pluginSections - Registered plugin settings sections.
 */
function SettingsPanel({
  section,
  pluginSections
}: {
  section: SettingsSection;
  pluginSections: ReturnType<typeof usePluginSettingsSections>;
}): JSX.Element | null {
  if (section === 'general') return <GeneralSection />;
  if (section === 'syntax') return <SyntaxHighlightingSection />;
  if (section === 'shortcuts') return <ShortcutsSection />;
  if (section === 'proxy') return <ProxySection />;
  if (section === 'storage') return <StorageLocationsSection />;
  if (section === 'ai') return <AiSection />;
  if (section === 'backup-restore') return <BackupRestoreSection />;
  if (section === 'plugins') return <PluginsSection />;

  const pluginSection = pluginSections.find((entry) => entry.id === section);
  if (pluginSection) {
    const Component = pluginSection.Component;
    return <Component />;
  }

  return null;
}

/**
 * Full-area application settings with sidebar navigation.
 */
export function Settings({ onClose, initialSection }: Props): JSX.Element {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const pluginSections = usePluginSettingsSections();

  const sidebarSections = useMemo(
    () => [
      ...SETTINGS_SECTIONS,
      ...pluginSections.map((entry) => ({
        value: entry.id as SettingsSection,
        label: entry.title,
        icon: faPuzzlePiece
      }))
    ],
    [pluginSections]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">Settings</h1>
        <Button
          type="button"
          variant="icon"
          className="opacity-100 text-[28px]"
          title="Close"
          aria-label="Close settings"
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <SettingsSidebar
          section={section}
          sections={sidebarSections}
          onSectionChange={setSection}
        />

        <div className="flex-1 overflow-y-auto p-6">
          <SettingsPanel section={section} pluginSections={pluginSections} />
        </div>
      </div>
    </div>
  );
}
