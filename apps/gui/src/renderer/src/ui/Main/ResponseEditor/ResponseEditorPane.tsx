import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { SegmentedTabs, SegmentedTabsGroup, type TabItem } from '@harborclient/sdk/components';
import type { CSSProperties, JSX, MouseEvent, ReactNode } from 'react';

interface Props {
  /**
   * Tabs shown in this pane's strip.
   */
  tabs: TabItem<string>[];

  /**
   * Active tab value for this pane.
   */
  value: string;

  /**
   * Called when the user selects a different tab in this pane.
   */
  onChange: (value: string) => void;

  /**
   * Accessible name for the pane tab list.
   */
  ariaLabel: string;

  /**
   * When true, shows the visibility menu on the tab strip.
   */
  editable?: boolean;

  /**
   * Called when the user right-clicks a tab in this pane.
   */
  onTabContextMenu?: (value: string, event: MouseEvent<HTMLButtonElement>) => void;

  /**
   * When true, content uses a fill-height overflow container instead of Scrollbars.
   */
  usesFillLayout?: boolean;

  /**
   * When true (default), tab strip and scroll area bleed with `-mx-3 -mt-2` to
   * match the outer ResponseEditor padding. When false (split panes), skip the
   * bleed but keep content `px-3` so flush Console sections cancel correctly.
   */
  bleedEdges?: boolean;

  /**
   * Tab panels for this pane (only panels belonging to {@link tabs}).
   */
  children: ReactNode;

  /**
   * Optional className for the outer pane container.
   */
  className?: string;

  /**
   * Optional inline style for sizing a secondary pane.
   */
  style?: CSSProperties;
}

/**
 * One response editor pane: segmented tab strip plus panel content.
 */
export function ResponseEditorPane({
  tabs,
  value,
  onChange,
  ariaLabel,
  editable = true,
  onTabContextMenu,
  usesFillLayout = false,
  bleedEdges = true,
  children,
  className,
  style
}: Props): JSX.Element {
  const needsLooseTabMargin = value === 'console' || value === 'logs';
  // Unsplit editor bleeds into outer ResponseEditor padding; split panes keep
  // content px-3 so flush Console sections (-mx-3) cancel correctly.
  const tabStripBleed = bleedEdges ? '-mx-3 -mt-2' : '';
  const scrollBleed = bleedEdges ? '-mx-3' : '';

  return (
    <div className={className ?? 'flex min-h-0 min-w-0 flex-1 flex-col'} style={style}>
      <SegmentedTabsGroup value={value} onChange={onChange} ariaLabel={ariaLabel}>
        <div
          className={`${tabStripBleed} flex shrink-0 items-center gap-2 border-b border-separator${
            needsLooseTabMargin ? '' : ' mb-4'
          }`}
        >
          <SegmentedTabs
            tabs={tabs}
            className="border-none"
            editable={editable}
            onTabContextMenu={onTabContextMenu}
          />
        </div>

        {usesFillLayout ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">{children}</div>
        ) : (
          <Scrollbars axis="both" className={`${scrollBleed} flex min-h-0 flex-1 flex-col`}>
            <div className="px-3 pb-3">{children}</div>
          </Scrollbars>
        )}
      </SegmentedTabsGroup>
    </div>
  );
}
