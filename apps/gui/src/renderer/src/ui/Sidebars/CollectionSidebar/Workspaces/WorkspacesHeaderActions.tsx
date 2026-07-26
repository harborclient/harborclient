import { useMemo, type JSX } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';
import { collectSidebarItemMarkers } from '../filter/sidebarMarkerFilter';
import { SidebarMarkerFilterButton } from '../filter/SidebarMarkerFilterButton';
import { SidebarSortButton } from '../sort/SidebarSortButton';

/**
 * Header actions for the Workspaces sidebar section (sort + marker filter).
 */
export function WorkspacesHeaderActions(): JSX.Element {
  const groups = useAppSelector(selectWorkspaces);
  const { workspacesMarkerFilter, setWorkspacesMarkerFilter } = useSidebarSectionFilter();

  /**
   * Distinct markers assigned to workspaces, sorted for the filter menu.
   */
  const markers = useMemo(() => collectSidebarItemMarkers(groups), [groups]);

  return (
    <>
      <SidebarSortButton
        sectionKey="workspaces"
        hasMarkerOption
        ariaLabel="Sort workspaces"
        title="Sort workspaces"
      />
      <SidebarMarkerFilterButton
        markers={markers}
        filter={workspacesMarkerFilter}
        onFilterChange={setWorkspacesMarkerFilter}
        ariaLabel="Filter workspaces by color marker"
        title="Filter by color marker"
      />
    </>
  );
}
