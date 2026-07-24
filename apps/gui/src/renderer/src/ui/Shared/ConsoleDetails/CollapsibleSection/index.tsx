import { withAccordionItem, type ItemStateProps } from '@szhsin/react-accordion';
import type { ForwardRefExoticComponent, JSX, MemoExoticComponent, RefAttributes } from 'react';

import { CollapsibleSectionItem, type ContentProps } from './CollapsibleSectionItem';

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

/**
 * Accordion-item HOC over {@link CollapsibleSectionItem} used by the public section wrapper.
 */
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
