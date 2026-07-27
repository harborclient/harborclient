import { useMemo } from 'react';
import type { RegisteredSidebarPanel } from '@harborclient/core/plugin/types';
import { usePluginSidebarPanels } from '#/renderer/src/plugins/pluginHooks';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveSidebarPanelId } from '#/renderer/src/store/slices/navigationSlice';
import {
  getNonReplacingSidebarPanels,
  resolveDisplayedSidebarPanel,
  selectCollectionsReplacementPanel,
  shouldRenderSidebarPanelSwitcher
} from './sidebarPanelResolution';

interface ResolvedSidebarPanels {
  /**
   * All registered sidebar panel contributions.
   */
  panels: RegisteredSidebarPanel[];

  /**
   * Redux active panel id (`null` = primary collections surface).
   */
  activePanelId: string | null;

  /**
   * Winning `replaces: "collections"` panel, if any.
   */
  collectionsReplacement: RegisteredSidebarPanel | null;

  /**
   * Panel body to mount, or `null` for the built-in Collections tree.
   */
  displayedPanel: RegisteredSidebarPanel | null;

  /**
   * Non-replacing panels shown as switcher destinations.
   */
  switcherPanels: RegisteredSidebarPanel[];

  /**
   * Whether the panel switcher strip should render.
   */
  showSwitcher: boolean;
}

/**
 * Derives collections-replacement and switcher state from the plugin registry
 * and Redux `activeSidebarPanelId`.
 *
 * Memoizes winner selection and display resolution so sidebar renders stay cheap.
 *
 * @returns Resolved panels for {@link SidebarContent} / {@link SidebarPanelSwitcher}.
 */
export function useResolvedSidebarPanels(): ResolvedSidebarPanels {
  const panels = usePluginSidebarPanels();
  const activePanelId = useAppSelector(selectActiveSidebarPanelId);

  /**
   * Picks the single collections replacement winner when one or more panels claim it.
   */
  const collectionsReplacement = useMemo(() => selectCollectionsReplacementPanel(panels), [panels]);

  /**
   * Resolves which HostedSurface (or built-in tree) the sidebar body should show.
   */
  const displayedPanel = useMemo(
    () => resolveDisplayedSidebarPanel(panels, activePanelId),
    [panels, activePanelId]
  );

  /**
   * Switchable destinations excluding collections replacement panels.
   */
  const switcherPanels = useMemo(() => getNonReplacingSidebarPanels(panels), [panels]);

  /**
   * Whether enough destinations exist to show the panel switcher strip.
   */
  const showSwitcher = useMemo(
    () => shouldRenderSidebarPanelSwitcher(panels, collectionsReplacement),
    [panels, collectionsReplacement]
  );

  return {
    panels,
    activePanelId,
    collectionsReplacement,
    displayedPanel,
    switcherPanels,
    showSwitcher
  };
}
