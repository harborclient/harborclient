import {
  useAccordionItem,
  useHeightTransition,
  useMergeRef,
  withAccordionItem,
  type ItemStateProps
} from '@szhsin/react-accordion';
import { Button, FaIcon } from '@harborclient/sdk/components';
import {
  memo,
  type ForwardRefExoticComponent,
  type JSX,
  type MemoExoticComponent,
  type ReactNode,
  type Ref,
  type RefAttributes
} from 'react';

import { faChevronDown, faChevronRight, faPlus } from '#/renderer/src/fontawesome';

interface SectionContentProps {
  /**
   * Section title shown in the header.
   */
  title: string;

  /**
   * Section body content.
   */
  children: ReactNode;

  /**
   * Called when the add button is clicked.
   */
  onAdd?: () => void;

  /**
   * Accessible label for the add button.
   */
  addLabel?: string;

  /**
   * Optional action controls rendered in the header row (for example plugin header actions).
   */
  headerActions?: ReactNode;
}

interface Props extends SectionContentProps {
  /**
   * Stable accordion item key shared with the sidebar provider.
   */
  itemKey: string;

  /**
   * Whether the section body starts expanded on first mount.
   */
  initialEntered: boolean;
}

type SectionItemProps = ItemStateProps<HTMLDivElement> & SectionContentProps;

/**
 * Renders the sidebar section header row and animated body panel.
 */
const SectionItem = memo(function SectionItem({
  forwardedRef,
  itemRef,
  state,
  toggle,
  title,
  children,
  onAdd,
  addLabel,
  headerActions
}: SectionItemProps): JSX.Element {
  const { buttonProps, panelProps } = useAccordionItem({ state, toggle });
  const [transitionStyle, panelRef] = useHeightTransition(state);
  const itemElementRef = useMergeRef<HTMLDivElement>(forwardedRef, itemRef);
  const { status, isMounted, isEnter } = state;

  return (
    <div ref={itemElementRef} className="mb-3">
      <div className="-mx-2 mb-1 flex items-center justify-between gap-2 bg-sidebar-section px-2 py-1">
        <button
          {...buttonProps}
          type="button"
          className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left app-no-drag"
        >
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
            <FaIcon
              icon={isEnter ? faChevronDown : faChevronRight}
              className="h-3 w-3 text-muted"
            />
          </span>
          <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">
            {title}
          </h2>
        </button>
        {(headerActions || onAdd) && (
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            {onAdd ? (
              <Button
                type="button"
                variant="toolbar"
                title={addLabel ?? 'Add'}
                aria-label={addLabel ?? 'Add'}
                className="inline-flex items-center gap-1"
                onClick={onAdd}
              >
                <FaIcon icon={faPlus} className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        )}
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
    </div>
  );
});

const AccordionSection = withAccordionItem(
  SectionItem as unknown as MemoExoticComponent<
    (props: ItemStateProps<HTMLDivElement>) => JSX.Element
  >
) as ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>;

/**
 * Collapsible sidebar section backed by `@szhsin/react-accordion` with optional add action.
 */
export function Section({
  itemKey,
  title,
  initialEntered,
  children,
  onAdd,
  addLabel,
  headerActions
}: Props): JSX.Element {
  return (
    <AccordionSection
      itemKey={itemKey}
      initialEntered={initialEntered}
      title={title}
      onAdd={onAdd}
      addLabel={addLabel}
      headerActions={headerActions}
    >
      {children}
    </AccordionSection>
  );
}
