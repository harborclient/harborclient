import type { JSX } from 'react';
import { SidebarProvidersProvider } from './providers/SidebarProvidersProvider';
import { SidebarSearchProvider } from './search/SidebarSearchProvider';
import { SidebarModalsProvider } from './modals/SidebarModals';
import { SidebarColorPickerProvider } from './colors/SidebarColorPickerProvider';
import { SidebarSelectionProvider } from './selection/SidebarSelectionProvider';
import { SidebarSelectionMenuHost } from './selection/SidebarSelectionMenuHost';
import { SidebarContent } from './shell/SidebarContent';

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
