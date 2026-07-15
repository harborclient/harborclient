import type { JSX } from 'react';
import { SidebarProvidersProvider } from './SidebarProvidersProvider';
import { SidebarSearchProvider } from './SidebarSearchProvider';
import { SidebarModalsProvider } from './SidebarModals';
import { SidebarColorPickerProvider } from './SidebarColorPickerProvider';
import { SidebarSelectionProvider } from './SidebarSelectionProvider';
import { SidebarSelectionMenuHost } from './SidebarSelectionMenuHost';
import { SidebarContent } from './SidebarContent';

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
