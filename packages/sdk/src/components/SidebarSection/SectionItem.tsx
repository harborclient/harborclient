import { faChevronDown, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  type ItemStateProps,
  useAccordionItem,
  useHeightTransition,
  useMergeRef,
  withAccordionItem
} from '@szhsin/react-accordion';
import { type JSX, type MemoExoticComponent, type ReactNode, type Ref, memo } from 'react';
import { FaIcon } from '../FaIcon/index.js';

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

  /**
   * When true, removes the margin below the header so body content sits flush against it.
   */
  flushBody?: boolean;
}

export interface Props extends SectionContentProps {
  /**
   * Stable accordion item key shared with the sidebar sections provider.
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
  headerActions,
  flushBody = false
}: SectionItemProps): JSX.Element {
  const { buttonProps, panelProps } = useAccordionItem({ state, toggle });
  const [transitionStyle, panelRef] = useHeightTransition(state);
  const itemElementRef = useMergeRef<HTMLDivElement>(forwardedRef, itemRef);
  const { status, isMounted, isEnter } = state;

  return (
    <div ref={itemElementRef} className="-mr-2 mb-1">
      <div
        className={`hc-sidebar-section-header flex min-h-8 items-center justify-between gap-2 bg-sidebar-section py-0.5 pr-2 ${flushBody ? 'mb-0' : 'mb-1'}`}
      >
        <button
          {...buttonProps}
          type="button"
          className="app-no-drag inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-left"
        >
          <span className="ms-2 inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <FaIcon
              icon={isEnter ? faChevronDown : faChevronRight}
              className="h-2 w-2 text-sidebar-section-text"
            />
          </span>
          <h2 className="m-0 text-[15px] leading-none font-medium tracking-wide text-sidebar-section-text uppercase">
            {title}
          </h2>
        </button>
        {(headerActions || onAdd) && (
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            {onAdd ? (
              <button
                type="button"
                className="hc-sidebar-add-button app-no-drag inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text"
                title={addLabel ?? 'Add'}
                aria-label={addLabel ?? 'Add'}
                onClick={onAdd}
              >
                <FaIcon icon={faPlus} className="h-4 w-4" />
              </button>
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
          className="transition-[height] duration-200 ease-out motion-reduce:transition-none"
        >
          <div {...panelProps} ref={panelRef as Ref<HTMLDivElement>}>
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export const AccordionSection = withAccordionItem(
  SectionItem as unknown as MemoExoticComponent<
    (props: ItemStateProps<HTMLDivElement>) => JSX.Element
  >
) as unknown as (props: Props) => JSX.Element;
