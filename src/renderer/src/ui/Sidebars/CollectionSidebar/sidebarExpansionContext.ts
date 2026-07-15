import { createContext } from 'react';
import type { usePersistedSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/usePersistedSidebarExpansion';

export type SidebarExpansionContextValue = ReturnType<typeof usePersistedSidebarExpansion>;

/**
 * React context for persisted sidebar expansion state shared across the app shell.
 */
export const SidebarExpansionContext = createContext<SidebarExpansionContextValue | null>(null);
