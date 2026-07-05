import {
  useAccordionItem,
  useHeightTransition,
  useMergeRef,
  withAccordionItem,
  type ItemStateProps
} from '@szhsin/react-accordion';
import { FaIcon } from '@harborclient/sdk/components';
import {
  memo,
  type ForwardRefExoticComponent,
  type JSX,
  type MemoExoticComponent,
  type ReactNode,
  type Ref,
  type RefAttributes
} from 'react';

import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';

interface ContentProps {
  /**
   * Section title shown in the inspector header.
   */
  title: string;

  /**
   * Section body content revealed below the header.
   */
  children: ReactNode;
}

interface Props extends ContentProps {
  /**
   * Stable accordion item key for this console detail section.
   */
  itemKey: string;

  /**
   * Whether the section body starts expanded on first mount.
   */
  initialEntered: boolean;
}

type SectionItemProps = ItemStateProps<HTMLDivElement> & ContentProps;

/**
 * Renders a Chrome-style inspector section with an accessible collapsible header.
 */
const CollapsibleSectionItem = memo(function CollapsibleSectionItem({
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

const AccordionSection = withAccordionItem(
  CollapsibleSectionItem as unknown as MemoExoticComponent<
    (props: ItemStateProps<HTMLDivElement>) => JSX.Element
  >
) as ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>;

/**
 * Collapsible console section backed by the local console detail accordion provider.
 */
export function CollapsibleSection({
  itemKey,
  title,
  initialEntered,
  children
}: Props): JSX.Element {
  return (
    <AccordionSection itemKey={itemKey} initialEntered={initialEntered} title={title}>
      {children}
    </AccordionSection>
  );
}
