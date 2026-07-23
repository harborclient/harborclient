import {
  useAccordionItem,
  useHeightTransition,
  useMergeRef,
  type ItemStateProps
} from '@szhsin/react-accordion';
import { FaIcon } from '@harborclient/sdk/components';
import { memo, type JSX, type ReactNode, type Ref } from 'react';

import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';

export interface ContentProps {
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
 * collection sidebar section headers (`bg-sidebar-section`).
 */
export const CollapsibleSectionItem = memo(function CollapsibleSectionItem({
  forwardedRef,
  itemRef,
  state,
  toggle,
  title,
  children
}: SectionItemProps): JSX.Element {
  const { buttonProps, panelProps } = useAccordionItem({ state, toggle });
  const [transitionStyle, panelRef] = useHeightTransition(state);
  const itemElementRef = useMergeRef<HTMLDivElement>(forwardedRef, itemRef);
  const { status, isMounted, isEnter } = state;

  return (
    <section ref={itemElementRef} className="border-b border-separator last:border-b-0">
      <div className="hc-sidebar-section-header flex min-h-8 items-center bg-sidebar-section py-0.5">
        <button
          {...buttonProps}
          type="button"
          className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent px-0 py-0 text-left text-[14px] font-medium app-no-drag"
        >
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
            <FaIcon
              icon={isEnter ? faChevronDown : faChevronRight}
              className="h-3 w-3 text-sidebar-section-text"
            />
          </span>
          <h3 className="m-0 text-[14px] font-medium text-sidebar-section-text">{title}</h3>
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
