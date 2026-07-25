import { ControlledAccordion, useAccordionProvider } from '@szhsin/react-accordion';
import { type JSX, type ReactNode, useEffect } from 'react';
import { SidebarSection } from './SidebarSection.js';

export { SidebarSection } from './SidebarSection.js';

type AccordionProviderValue = ReturnType<typeof useAccordionProvider>;

/**
 * Typed wrapper so accordion JSX is compatible with strict React 19 element checks.
 */
const AccordionRoot = ControlledAccordion as unknown as (props: {
  providerValue: AccordionProviderValue;
  children?: ReactNode;
}) => JSX.Element;

/**
 * Configuration for one collapsible sidebar section.
 */
export interface SidebarSectionConfig {
  /**
   * Stable accordion key and React list key.
   */
  key: string;

  /**
   * Section title shown in the header.
   */
  title: string;

  /**
   * Accessible label for the section navigation landmark.
   */
  ariaLabel?: string;

  /**
   * Whether the section body starts expanded on first mount.
   */
  initialEntered?: boolean;

  /**
   * Called when the add button is clicked.
   */
  onAdd?: () => void;

  /**
   * Accessible label for the add button.
   */
  addLabel?: string;

  /**
   * Optional action controls rendered in the header row.
   */
  headerActions?: ReactNode;

  /**
   * When true, removes the margin below the header so body content sits flush against it.
   */
  flushBody?: boolean;

  /**
   * Section body content.
   */
  children: ReactNode;
}

interface Props {
  /**
   * Sections to render in order.
   */
  sections: SidebarSectionConfig[];

  /**
   * Controlled expanded state keyed by section key.
   */
  expanded?: Record<string, boolean>;

  /**
   * Called when a section is expanded or collapsed.
   */
  onToggle?: (key: string, expanded: boolean) => void;
}

/**
 * Accordion-backed container for collapsible sidebar sections.
 *
 * Owns the accordion provider so host apps only need to supply section config
 * and optional controlled `expanded` / `onToggle` persistence hooks.
 */
export function SidebarSections({ sections, expanded, onToggle }: Props): JSX.Element {
  const { stateMap, toggle, ...providerRest } = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true,
    onStateChange: ({ key, current }) => {
      onToggle?.(String(key), current.isEnter);
    }
  });
  const providerValue = { stateMap, toggle, ...providerRest };

  /**
   * Syncs controlled expanded state from the host into the accordion provider.
   */
  useEffect(() => {
    if (!expanded) {
      return;
    }

    for (const [key, isExpanded] of Object.entries(expanded)) {
      const currentExpanded = stateMap.get(key)?.isEnter;
      if (currentExpanded !== isExpanded) {
        toggle(key, isExpanded);
      }
    }
  }, [expanded, stateMap, toggle]);

  return (
    <AccordionRoot providerValue={providerValue}>
      {sections.map((section) => (
        <nav key={section.key} aria-label={section.ariaLabel ?? section.title}>
          <SidebarSection
            itemKey={section.key}
            title={section.title}
            initialEntered={section.initialEntered ?? true}
            onAdd={section.onAdd}
            addLabel={section.addLabel}
            headerActions={section.headerActions}
            flushBody={section.flushBody}
          >
            {section.children}
          </SidebarSection>
        </nav>
      ))}
    </AccordionRoot>
  );
}
