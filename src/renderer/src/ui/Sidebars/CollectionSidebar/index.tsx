import type { JSX } from 'react';
import { SidebarProvidersProvider } from './providers/SidebarProvidersProvider';
import { SidebarSearchProvider } from './search/SidebarSearchProvider';
import { SidebarColorPickerProvider } from './colors/SidebarColorPickerProvider';
import { SidebarSelectionProvider } from './selection/SidebarSelectionProvider';
import { SidebarSelectionMenuHost } from './selection/SidebarSelectionMenuHost';
import { SidebarContent } from './shell/SidebarContent';

/**
 * Left sidebar with collapsible collections, environments, history, and run-results
 * sections. Mounts the sidebar context providers (providers, search, and selection)
 * so each section can own its own data and actions. Folder/document rename modals
 * live in SidebarModalsProvider at the app layout level so the markdown editor
 * tab can open them as well.
 */
export function CollectionSidebar(): JSX.Element {
  return (
    <SidebarProvidersProvider>
      <SidebarSearchProvider>
        <SidebarColorPickerProvider>
          <SidebarSelectionProvider>
            <SidebarSelectionMenuHost />
            <SidebarContent />
          </SidebarSelectionProvider>
        </SidebarColorPickerProvider>
      </SidebarSearchProvider>
    </SidebarProvidersProvider>
  );
}
