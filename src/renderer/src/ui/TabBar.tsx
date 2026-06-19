import type { JSX } from 'react';
import { isTabDirty, type RequestTab } from '#/renderer/src/store/drafts';
import { METHOD_CLASSES } from './classes';

interface Props {
  /**
   * All open request tabs.
   */
  tabs: RequestTab[];

  /**
   * ID of the currently active tab.
   */
  activeTabId: string;

  /**
   * Called when the user selects a tab.
   *
   * @param tabId - Tab to activate.
   */
  onSelect: (tabId: string) => void;

  /**
   * Called when the user closes a tab.
   *
   * @param tabId - Tab to close.
   */
  onClose: (tabId: string) => void;

  /**
   * Opens a new blank request tab.
   */
  onNew: () => void;
}

/**
 * Horizontal tab bar for switching between open request editors.
 */
export function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: Props): JSX.Element {
  return (
    <div className="flex shrink-0 items-end gap-0 overflow-x-auto border-b border-separator bg-sidebar px-2 pt-1 app-no-drag">
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId;
        return (
          <div
            key={tab.tabId}
            className={`group flex max-w-[220px] shrink-0 items-stretch gap-1.5 rounded-t-md border border-b-0 px-4 ${active
              ? 'border-separator bg-surface text-text'
              : 'border-transparent bg-transparent text-muted hover:bg-selection/60 hover:text-text'
              }`}
          >
            <button
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 py-2 text-inherit app-no-drag"
              onClick={() => onSelect(tab.tabId)}
            >
              <span
                className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'bg-info text-white'}`}
              >
                {tab.draft.method}
              </span>
              {isTabDirty(tab) && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                  title="Unsaved changes"
                />
              )}
              <span className="truncate text-[13px]">{tab.draft.name}</span>
            </button>
            <button
              className="inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center self-stretch rounded-md border-none bg-transparent text-[14px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-text app-no-drag"
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.tabId);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <div className="flex shrink-0 items-center rounded-t-md border border-b-0 border-transparent bg-transparent px-2 py-2 text-muted hover:bg-selection/60 hover:text-text">
        <button
          className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[13px] text-inherit app-no-drag"
          title="New tab"
          onClick={onNew}
        >
          +
        </button>
      </div>
    </div>
  );
}
