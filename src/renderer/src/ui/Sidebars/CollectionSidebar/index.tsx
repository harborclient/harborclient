import type { JSX } from 'react';
import { SidebarProvidersProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarProvidersProvider';
import { SidebarSearchProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarSearchProvider';
import { SidebarModalsProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarModals';
import { SidebarColorPickerProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarColorPickerProvider';
import { SidebarSelectionProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarSelectionProvider';
import { SidebarSelectionMenuHost } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarSelectionMenuHost';
import { SidebarContent } from '#/renderer/src/ui/Sidebars/CollectionSidebar/SidebarContent';

/**
 * Left sidebar with collapsible collections, environments, history, and run-results
 * sections. Mounts the sidebar context providers (providers, git, search, and
 * modals) so each section can own its own data and actions.
 */
export function CollectionSidebar(): JSX.Element {
  return (
    <SidebarProvidersProvider>
      <SidebarSearchProvider>
        <SidebarModalsProvider>
          <SidebarColorPickerProvider>
            <SidebarSelectionProvider>
              <SidebarSelectionMenuHost />
              <SidebarContent />
            </SidebarSelectionProvider>
          </SidebarColorPickerProvider>
        </SidebarModalsProvider>
      </SidebarSearchProvider>
    </SidebarProvidersProvider>
  );
}
