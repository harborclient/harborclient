import { Page, SidebarLayout } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, type JSX } from 'react';

import { faPuzzlePiece } from '#/renderer/src/fontawesome';
import { usePersistedPageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection';
import { normalizePageSidebarSection } from '#/shared/pageSidebarSection';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { usePluginSettingsSections } from '#/renderer/src/plugins/pluginHooks';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { loadSettingsDraft } from '#/renderer/src/store/thunks/settingsDraft';
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

  /**
   * When set, focuses the matching global variable row in the Globals section.
   */
  focusVariableKey?: string;
}

/**
 * Full-area application settings with sidebar navigation and catalog search.
 */
export function Settings({ initialSection, focusVariableKey }: Props): JSX.Element {
  const dispatch = useAppDispatch();
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

  /**
   * Treat menu opens with General as non-override so persisted memory wins.
   */
  const navigationOverride = useMemo(
    () => (initialSection !== 'general' ? initialSection : undefined),
    [initialSection]
  );

  /**
   * Validates sidebar section ids against built-in allowlists and registered plugins.
   */
  const isValidSection = useCallback(
    (candidate: string): candidate is SettingsSection => {
      if (!normalizePageSidebarSection('settings', candidate)) {
        return false;
      }
      if (!candidate.startsWith('plugin:')) {
        return true;
      }
      return sidebarSections.some((entry) => entry.value === candidate);
    },
    [sidebarSections]
  );

  const { section, setSection } = usePersistedPageSidebarSection<SettingsSection>({
    pageKey: 'settings',
    defaultSection: 'general',
    isValidSection,
    navigationOverride
  });

  const pluginSection = pluginSections.find((entry) => entry.id === section);

  /**
   * Loads the shared settings draft once when the settings panel opens.
   */
  useEffect(() => {
    void dispatch(loadSettingsDraft());
  }, [dispatch]);

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
        <Page
          embedded
          title={pluginSection.title}
          icon={faPuzzlePiece}
          className="flex min-h-full flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <PluginSurface
              pluginId={pluginSection.pluginId}
              contributionId={pluginSection.contributionId}
              kind="settingsSections"
              resizeMode="fill"
              className="h-full"
            />
          </div>
        </Page>
      ) : (
        <SettingsRenderer section={section} focusVariableKey={focusVariableKey} />
      )}
    </SidebarLayout>
  );
}
