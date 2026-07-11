import { useAccordionProvider } from '@szhsin/react-accordion';
import { useCallback, useEffect, useState } from 'react';
import { usePluginSidebarSections } from '#/renderer/src/plugins/pluginHooks';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';

/**
 * Accordion state for the sidebar sections plus plugin-section expansion.
 */
interface Result {
  /**
   * Accordion provider value to pass to `ControlledAccordion`.
   */
  accordion: ReturnType<typeof useAccordionProvider>;

  /**
   * Expansion state keyed by plugin sidebar section id.
   */
  pluginSectionExpanded: Record<string, boolean>;
}

/**
 * Wires the sidebar accordion to persisted section-expansion booleans.
 *
 * Owns the accordion provider, mirrors user toggles into persisted state, and
 * pushes programmatic expansion changes (search, reveal, hydration) back into
 * the accordion.
 */
export function useSidebarAccordion(): Result {
  const pluginSidebarSections = usePluginSidebarSections();
  const [pluginSectionExpanded, setPluginSectionExpanded] = useState<Record<string, boolean>>({});
  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setRunResultsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible
  } = useSidebarExpansion();

  /**
   * Writes accordion item state into the persisted sidebar expansion booleans.
   *
   * @param key - Accordion item key (`collections`, `environments`, `runResults`, or a plugin section id).
   * @param isEnter - Whether the section body should be expanded.
   */
  const applySectionExpanded = useCallback(
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

      setPluginSectionExpanded((current) => {
        const previous = current[key] ?? true;
        if (previous === isEnter) {
          return current;
        }
        return { ...current, [key]: isEnter };
      });
    },
    [setCollectionsSectionExpanded, setEnvironmentsSectionExpanded, setRunResultsSectionExpanded]
  );

  const accordion = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true,
    onStateChange: ({ key, current }) => {
      applySectionExpanded(String(key), current.isEnter);
    }
  });
  const { stateMap, toggle } = accordion;

  /**
   * Pushes programmatic expansion changes (search, reveal, hydration) into the
   * accordion. `stateMap` is read when persisted booleans change but omitted
   * from deps so user toggles do not re-trigger sync and snap sections back open.
   */
  useEffect(() => {
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

    for (const section of pluginSidebarSections) {
      desiredExpansion[section.id] = pluginSectionExpanded[section.id] ?? true;
    }

    for (const [key, wantExpanded] of Object.entries(desiredExpansion)) {
      const isExpanded = stateMap.get(key)?.isEnter;
      if (isExpanded !== wantExpanded) {
        toggle(key, wantExpanded);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateMap intentionally excluded; see docblock
  }, [
    toggle,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    runResultsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    pluginSectionExpanded,
    pluginSidebarSections
  ]);

  return { accordion, pluginSectionExpanded };
}
