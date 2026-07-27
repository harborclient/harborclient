import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FaIcon, FormGroup, Input, sourceRow } from '@harborclient/sdk/components';
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
 * Settings sidebar with an integrated search field and section navigation rows.
 * Row chrome matches collections sidebar items via {@link sourceRow}.
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
    <aside className="hc-settings-sidebar flex w-[300px] shrink-0 flex-col border-r border-separator bg-sidebar">
      <div className="px-2 pt-3">
        <FormGroup label="Search settings" htmlFor="settings-search" bordered={false} srOnly>
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
        className="flex flex-col gap-0 px-2 py-3"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
      >
        {items.map((item) => {
          const active = selected === item.value;
          const cursorClass = disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';
          const iconGap = item.icon ? '!gap-2 ' : '';
          const rowClass = `hc-sidebar-item ${sourceRow(active, true)} min-h-[30px] w-full border-none text-left text-inherit ${iconGap}${cursorClass}`;

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
                <FaIcon icon={item.icon} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              ) : null}
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
