import {
  useAccordionItem,
  useHeightTransition,
  useMergeRef,
  type ItemStateProps
} from '@szhsin/react-accordion';
import {
  FaIcon,
  SIDEBAR_CHEVRON_ICON_CLASS,
  SIDEBAR_CHEVRON_SLOT_CLASS
} from '@harborclient/sdk/components';
import { memo, type JSX, type ReactNode, type Ref } from 'react';

import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';

export interface ContentProps {
  /**
   * When true, the section header breaks out of horizontal inset padding using
   * negative margins (same technique as collection sidebar section headers).
   */
  flush?: boolean;

  /**
   * Section title shown in the inspector header.
   */
  title: string;

  /**
   * Section body content revealed below the header.
   */
  children: ReactNode;
}

type SectionItemProps = ItemStateProps<HTMLDivElement> & ContentProps;

/**
 * Renders a collapsible console inspector section whose header chrome matches
 * collection sidebar section headers (`bg-sidebar-section`), including shared
 * `SIDEBAR_CHEVRON_*` inset and title gap.
 */
export const CollapsibleSectionItem = memo(function CollapsibleSectionItem({
  forwardedRef,
  itemRef,
  state,
  toggle,
  flush = false,
  title,
  children
}: SectionItemProps): JSX.Element {
  const { buttonProps, panelProps } = useAccordionItem({ state, toggle });
  const [transitionStyle, panelRef] = useHeightTransition(state);
  const itemElementRef = useMergeRef<HTMLDivElement>(forwardedRef, itemRef);
  const { status, isMounted, isEnter } = state;

  return (
    <section ref={itemElementRef} className={`mb-1 last:mb-0${flush ? ' -mx-3' : ''}`}>
      <div className="hc-sidebar-section-header mb-1 flex min-h-8 items-center justify-between gap-2 border-b border-sidebar-rail-separator bg-sidebar-section py-0.5 pr-2">
        <button
          {...buttonProps}
          type="button"
          className="app-no-drag inline-flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
        >
          <span className={SIDEBAR_CHEVRON_SLOT_CLASS}>
            <FaIcon
              icon={isEnter ? faChevronDown : faChevronRight}
              className={`${SIDEBAR_CHEVRON_ICON_CLASS} text-sidebar-section-text`}
            />
          </span>
          <h2 className="m-0 text-[15px] leading-none font-medium tracking-wide text-sidebar-section-text uppercase">
            {title}
          </h2>
        </button>
      </div>
      {isMounted ? (
        <div
          style={{
            display: status === 'exited' ? 'none' : undefined,
            ...transitionStyle
          }}
          className="motion-reduce:transition-none"
        >
          <div {...panelProps} ref={panelRef as Ref<HTMLDivElement>}>
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
});
