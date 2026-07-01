import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FormGroup, Input } from '@harborclient/sdk/components';
import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface SidebarItem<T extends string = string> {
  /**
   * Stable section identifier passed to `onSelect` when the row is activated.
   */
  value: T;

  /**
   * Visible label for the navigation row.
   */
  label: string;

  /**
   * Optional decorative icon shown before the label.
   */
  icon?: IconDefinition;
}

interface Props<T extends string> {
  /**
   * Navigation entries to render below the search field.
   */
  items: SidebarItem<T>[];

  /**
   * Currently selected section value.
   */
  selected: T;

  /**
   * Called when the user selects a different section.
   */
  onSelect: (value: T) => void;

  /**
   * Accessible name for the sidebar `nav` element.
   */
  ariaLabel: string;

  /**
   * Current settings search query.
   */
  searchValue: string;

  /**
   * Called when the user edits the search field.
   */
  onSearchChange: (value: string) => void;

  /**
   * When true, section navigation rows are disabled while search is active.
   */
  disabled?: boolean;
}

/**
 * Tailwind classes for a sidebar navigation row.
 *
 * @param active - Whether this row is the current selection.
 * @param disabled - Whether navigation is temporarily disabled during search.
 */
function sidebarRow(active: boolean, disabled: boolean): string {
  const base = active
    ? 'group flex cursor-pointer items-center gap-1 rounded-md bg-selection px-1.5 py-0.5 app-no-drag'
    : 'group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-selection/60 app-no-drag';

  if (disabled) {
    return `${base} opacity-50 cursor-not-allowed`;
  }

  return base;
}

/**
 * Settings sidebar with an integrated search field and section navigation rows.
 */
export function SettingsSidebar<T extends string>({
  items,
  selected,
  onSelect,
  ariaLabel,
  searchValue,
  onSearchChange,
  disabled = false
}: Props<T>): JSX.Element {
  return (
    <aside className="hc-settings-sidebar flex w-[220px] shrink-0 flex-col border-r border-separator bg-sidebar">
      <div className="border-b border-separator px-2 py-3">
        <FormGroup label="Search settings" htmlFor="settings-search" srOnly>
          <Input
            id="settings-search"
            type="search"
            placeholder="Search"
            value={searchValue}
            className="w-full"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </FormGroup>
      </div>

      <nav
        className="flex flex-col gap-0.5 px-2 py-3"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
      >
        {items.map((item) => {
          const active = selected === item.value;
          const rowClass = item.icon
            ? `${sidebarRow(active, disabled)} w-full gap-2 border-none text-left text-[15px] app-no-drag`
            : `${sidebarRow(active, disabled)} w-full border-none text-left text-[15px] app-no-drag`;

          return (
            <button
              key={item.value}
              type="button"
              className={rowClass}
              aria-current={active ? 'page' : undefined}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                onSelect(item.value);
              }}
            >
              {item.icon ? (
                <FaIcon
                  icon={item.icon}
                  className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-text' : 'text-muted'}`}
                  aria-hidden
                />
              ) : null}
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
