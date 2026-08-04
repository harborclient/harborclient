import { FaIcon, Sidebar } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faKeyboard } from '#/renderer/src/fontawesome';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSidebarPlacement } from '#/renderer/src/store/slices/navigationSlice';
import { ShortcutsEditor } from './ShortcutsEditor';

/**
 * Docked Shortcuts editor panel with search, press-to-record editing, and restore
 * defaults. Side follows the opposite edge of the collections sidebar.
 */
export function ShortcutsSidebar(): JSX.Element {
  const sidebarPlacement = useAppSelector(selectSidebarPlacement);

  return (
    <Sidebar
      side={sidebarPlacement === 'left' ? 'right' : 'left'}
      ariaLabel="Shortcuts"
      storageKey="hc.shortcutsSidebarWidth"
      defaultSize={360}
      minSize={280}
      getMaxSize={() => 640}
      resizeAriaLabel="Resize Shortcuts sidebar"
      header={
        <div className="flex h-[56px] items-center gap-2 border-b border-separator px-2 py-1">
          <div className="inline-flex min-w-0 items-center gap-1.5 text-text">
            <FaIcon icon={faKeyboard} className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">Shortcuts</span>
          </div>
        </div>
      }
    >
      <ShortcutsEditor />
    </Sidebar>
  );
}
