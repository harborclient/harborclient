import { Page, SidebarLayout } from '@harborclient/sdk/components';
import { useMemo, useState, type JSX } from 'react';

import { faPuzzlePiece } from '#/renderer/src/fontawesome';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { usePluginSettingsSections } from '#/renderer/src/plugins/pluginHooks';
import { SETTINGS_SECTIONS } from './constants';
import { SettingsRenderer } from './catalog/SettingsRenderer';
import { SettingsSearchResults } from './catalog/SettingsSearchResults';
import { SettingsSidebar } from './SettingsSidebar';
import { useSettingsSearch } from './hooks/useSettingsSearch';
import type { SettingsSection } from './types';

interface Props {
  /**
   * Settings section to show when the overlay opens.
   */
  initialSection: SettingsSection;
}

/**
 * Full-area application settings with sidebar navigation and catalog search.
 */
export function Settings({ initialSection }: Props): JSX.Element {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const pluginSections = usePluginSettingsSections();
  const { query, setQuery, matchedIds, isSearching } = useSettingsSearch();

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

  const pluginSection = pluginSections.find((entry) => entry.id === section);

  /**
   * Opens a management section from search results and clears the active query.
   */
  const handleNavigateFromSearch = (nextSection: SettingsSection): void => {
    setSection(nextSection);
    setQuery('');
  };

  return (
    <SidebarLayout
      sidebar={
        <SettingsSidebar
          ariaLabel="Settings sections"
          selected={section}
          onSelect={setSection}
          items={sidebarSections}
          searchValue={query}
          onSearchChange={setQuery}
          disabled={isSearching}
        />
      }
    >
      {isSearching ? (
        <SettingsSearchResults
          matchedIds={matchedIds}
          query={query}
          onNavigate={handleNavigateFromSearch}
        />
      ) : pluginSection ? (
        <Page embedded title={pluginSection.title} icon={faPuzzlePiece}>
          <PluginSurface
            pluginId={pluginSection.pluginId}
            contributionId={pluginSection.contributionId}
            kind="settingsSections"
            minHeight={400}
          />
        </Page>
      ) : (
        <SettingsRenderer section={section} />
      )}
    </SidebarLayout>
  );
}
