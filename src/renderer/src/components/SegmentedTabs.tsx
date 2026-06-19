import type { JSX, ReactNode } from 'react';
import { segment, segmentGroup } from '#/renderer/src/ui/classes';

export interface TabItem<T extends string> {
  /**
   * Unique tab identifier.
   */
  value: T;

  /**
   * Tab label or custom content.
   */
  label: ReactNode;

  /**
   * When true, the tab is not rendered.
   */
  hidden?: boolean;

  /**
   * When true, the tab button is disabled.
   */
  disabled?: boolean;
}

interface Props<T extends string> {
  /**
   * Tab definitions to render.
   */
  tabs: TabItem<T>[];

  /**
   * Currently selected tab value.
   */
  value: T;

  /**
   * Called when the user selects a different tab.
   *
   * @param value - Newly selected tab value.
   */
  onChange: (value: T) => void;

  /**
   * When true, the group and each tab stretch to full width.
   */
  fullWidth?: boolean;

  /**
   * Additional CSS classes for the tab group container.
   */
  className?: string;
}

/**
 * macOS-style segmented tab control.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  fullWidth = false,
  className
}: Props<T>): JSX.Element {
  const groupClassName = [segmentGroup, fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={groupClassName}>
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`${segment(value === tab.value)}${fullWidth ? ' flex-1' : ''}`}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
    </div>
  );
}
