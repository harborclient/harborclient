import { useCallback, useMemo, useState } from 'react';
import { usePluginSidebarSections } from '#/renderer/src/plugins/pluginHooks';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarExpansion';

/**
 * Accordion state for the sidebar sections plus plugin-section expansion.
 */
interface Result {
  /**
   * Controlled expanded state keyed by section id for `SidebarSections`.
   */
  expanded: Record<string, boolean>;

  /**
   * Persists accordion toggles into sidebar expansion settings.
   */
  onToggle: (key: string, expanded: boolean) => void;

  /**
   * Expansion state keyed by plugin sidebar section id.
   */
  pluginSectionExpanded: Record<string, boolean>;
}

/**
 * Builds controlled accordion state for the collections sidebar sections.
 *
 * Mirrors persisted section-expansion booleans into the SDK `SidebarSections`
 * `expanded` map and writes user toggles back into persisted settings.
 */
export function useSidebarAccordion(): Result {
  const pluginSidebarSections = usePluginSidebarSections();
  const [pluginSectionExpanded, setPluginSectionExpanded] = useState<Record<string, boolean>>({});
  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    tabGroupsSectionExpanded,
    trashSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setRunResultsSectionExpanded,
    setHistorySectionExpanded,
    setTabGroupsSectionExpanded,
    setTrashSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    historySectionVisible,
    tabGroupsSectionVisible,
    trashSectionVisible
  } = useSidebarExpansion();

  /**
   * Writes accordion item state into the persisted sidebar expansion booleans.
   *
   * @param key - Accordion item key (`collections`, `environments`, `runResults`, `history`, or a plugin section id).
   * @param isEnter - Whether the section body should be expanded.
   */
  const onToggle = useCallback(
    (key: string, isEnter: boolean): void => {
      if (key === 'collections') {
        setCollectionsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'environments') {
        setEnvironmentsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'runResults') {
        setRunResultsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'history') {
        setHistorySectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'tabGroups') {
        setTabGroupsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'trash') {
        setTrashSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      setPluginSectionExpanded((current) => {
        const previous = current[key] ?? true;
        if (previous === isEnter) {
          return current;
        }
        return { ...current, [key]: isEnter };
      });
    },
    [
      setCollectionsSectionExpanded,
      setEnvironmentsSectionExpanded,
      setRunResultsSectionExpanded,
      setHistorySectionExpanded,
      setTabGroupsSectionExpanded,
      setTrashSectionExpanded
    ]
  );

  /**
   * Controlled expanded map fed into SDK `SidebarSections`.
   */
  const expanded = useMemo((): Record<string, boolean> => {
    const desiredExpansion: Record<string, boolean> = {};

    if (collectionsSectionVisible) {
      desiredExpansion.collections = collectionsSectionExpanded;
    }

    if (environmentsSectionVisible) {
      desiredExpansion.environments = environmentsSectionExpanded;
    }

    if (runResultsSectionVisible) {
      desiredExpansion.runResults = runResultsSectionExpanded;
    }

    if (historySectionVisible) {
      desiredExpansion.history = historySectionExpanded;
    }

    if (tabGroupsSectionVisible) {
      desiredExpansion.tabGroups = tabGroupsSectionExpanded;
    }

    if (trashSectionVisible) {
      desiredExpansion.trash = trashSectionExpanded;
    }

    for (const section of pluginSidebarSections) {
      desiredExpansion[section.id] = pluginSectionExpanded[section.id] ?? true;
    }

    return desiredExpansion;
  }, [
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    tabGroupsSectionExpanded,
    trashSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    historySectionVisible,
    tabGroupsSectionVisible,
    trashSectionVisible,
    pluginSectionExpanded,
    pluginSidebarSections
  ]);

  return { expanded, onToggle, pluginSectionExpanded };
}
