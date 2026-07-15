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
 * Renders a Chrome-style inspector section with an accessible collapsible header.
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
      <button
        {...buttonProps}
        type="button"
        className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent px-0 py-1.5 text-left text-[14px] font-medium text-text hover:bg-selection/40 app-no-drag"
      >
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={isEnter ? faChevronDown : faChevronRight} className="h-3 w-3 text-muted" />
        </span>
        <h3 className="m-0 text-[14px] font-medium text-text">{title}</h3>
      </button>
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
