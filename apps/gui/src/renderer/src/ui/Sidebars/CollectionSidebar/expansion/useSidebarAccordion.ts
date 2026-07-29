import { useCallback, useMemo, useState } from 'react';
import { SIDEBAR_MODE_SECTIONS } from '@harborclient/core/sidebarExpansion';
import type { SidebarSectionKey } from '@harborclient/core/types';
import { usePluginSidebarSections } from '#/renderer/src/plugins/pluginHooks';
import { builtInSectionsToCollapse, collapsePluginSectionsInMap } from './collapseSidebarSections';
import { useSidebarExpansion } from './useSidebarExpansion';

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

  /**
   * Collapses the given built-in and plugin sidebar section headers only.
   *
   * @param keys - Section keys currently visible in the sidebar body.
   */
  collapseSections: (keys: readonly string[]) => void;
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
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    archiveSectionExpanded,
    trashSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setRunResultsSectionExpanded,
    setHistorySectionExpanded,
    setWorkspacesSectionExpanded,
    setWorkflowsSectionExpanded,
    setArchiveSectionExpanded,
    setTrashSectionExpanded,
    activeSidebarMode
  } = useSidebarExpansion();

  /**
   * Writes accordion item state into the persisted sidebar expansion booleans.
   *
   * @param key - Accordion item key (`collections`, `environments`, `runResults`, `history`, `archive`, `trash`, or a plugin section id).
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

      if (key === 'workspaces') {
        setWorkspacesSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'workflows') {
        setWorkflowsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'archive') {
        setArchiveSectionExpanded((current) => (current === isEnter ? current : isEnter));
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
      setWorkspacesSectionExpanded,
      setWorkflowsSectionExpanded,
      setArchiveSectionExpanded,
      setTrashSectionExpanded
    ]
  );

  /**
   * Controlled expanded map fed into SDK `SidebarSections`.
   *
   * Includes every section for the active rail mode (and plugin sections when the
   * Collections mode is active) so mounted accordion items stay controlled.
   */
  const expanded = useMemo((): Record<string, boolean> => {
    const desiredExpansion: Record<string, boolean> = {};
    const modeSections = SIDEBAR_MODE_SECTIONS[activeSidebarMode];
    const sectionExpandedByKey = {
      collections: collectionsSectionExpanded,
      environments: environmentsSectionExpanded,
      runResults: runResultsSectionExpanded,
      history: historySectionExpanded,
      workspaces: workspacesSectionExpanded,
      workflows: workflowsSectionExpanded,
      archive: archiveSectionExpanded,
      trash: trashSectionExpanded
    } as const;

    for (const key of modeSections) {
      desiredExpansion[key] = sectionExpandedByKey[key];
    }

    // Search may temporarily mount Collections / Environments / Archive outside the
    // active mode; keep their accordion state available in the controlled map.
    desiredExpansion.collections = collectionsSectionExpanded;
    desiredExpansion.environments = environmentsSectionExpanded;
    desiredExpansion.archive = archiveSectionExpanded;

    if (activeSidebarMode === 'collections') {
      for (const section of pluginSidebarSections) {
        desiredExpansion[section.id] = pluginSectionExpanded[section.id] ?? true;
      }
    }

    return desiredExpansion;
  }, [
    activeSidebarMode,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    historySectionExpanded,
    workspacesSectionExpanded,
    workflowsSectionExpanded,
    archiveSectionExpanded,
    trashSectionExpanded,
    pluginSectionExpanded,
    pluginSidebarSections
  ]);

  /**
   * Collapses only the section keys currently visible in the sidebar body.
   *
   * Used as the second step of the Collapse all control when no trees remain
   * expanded for the active rail mode. Sections outside `keys` keep their state
   * so switching modes does not surprise the user with collapsed headers.
   *
   * @param keys - Built-in or plugin section ids currently mounted.
   */
  const collapseSections = useCallback(
    (keys: readonly string[]): void => {
      const setters: Record<SidebarSectionKey, (value: boolean) => void> = {
        collections: setCollectionsSectionExpanded,
        environments: setEnvironmentsSectionExpanded,
        runResults: setRunResultsSectionExpanded,
        history: setHistorySectionExpanded,
        workspaces: setWorkspacesSectionExpanded,
        workflows: setWorkflowsSectionExpanded,
        archive: setArchiveSectionExpanded,
        trash: setTrashSectionExpanded
      };

      for (const key of builtInSectionsToCollapse(keys)) {
        setters[key](false);
      }

      const pluginIds = pluginSidebarSections.map((section) => section.id);
      setPluginSectionExpanded((current) => collapsePluginSectionsInMap(current, keys, pluginIds));
    },
    [
      pluginSidebarSections,
      setCollectionsSectionExpanded,
      setEnvironmentsSectionExpanded,
      setRunResultsSectionExpanded,
      setHistorySectionExpanded,
      setWorkspacesSectionExpanded,
      setWorkflowsSectionExpanded,
      setArchiveSectionExpanded,
      setTrashSectionExpanded
    ]
  );

  return { expanded, onToggle, pluginSectionExpanded, collapseSections };
}
