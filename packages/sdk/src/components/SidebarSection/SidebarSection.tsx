import type { JSX } from 'react';
import { AccordionSection, type Props } from './SectionItem.js';

/**
 * Collapsible sidebar section backed by `@szhsin/react-accordion` with optional add action.
 */
export function SidebarSection({
  itemKey,
  title,
  initialEntered,
  children,
  onAdd,
  addLabel,
  headerActions,
  flushBody
}: Props): JSX.Element {
  return (
    <AccordionSection
      itemKey={itemKey}
      initialEntered={initialEntered}
      title={title}
      onAdd={onAdd}
      addLabel={addLabel}
      headerActions={headerActions}
      flushBody={flushBody}
    >
      {children}
    </AccordionSection>
  );
}
