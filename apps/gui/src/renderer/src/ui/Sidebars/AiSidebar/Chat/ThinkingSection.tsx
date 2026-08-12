import { FaIcon } from '@harborclient/sdk/components';
import { useId, useState, type JSX } from 'react';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { AnimatedCollapse } from '#/renderer/src/ui/Shared/Animated/AnimatedCollapse';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  /**
   * Ephemeral thought markdown accumulated for the active turn.
   */
  thought: string;
}

/**
 * Collapsible Thinking region for ephemeral provider reasoning text.
 *
 * Collapsed by default, keyboard operable, and labelled for screen readers.
 */
export function ThinkingSection({ thought }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-3 rounded-lg border border-separator bg-control/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <FaIcon
          icon={open ? faChevronDown : faChevronRight}
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
        />
        <span>Thinking</span>
      </button>
      <AnimatedCollapse open={open}>
        <div
          id={panelId}
          className="border-t border-separator px-3 py-2 text-muted"
          role="region"
          aria-label="Model thinking"
        >
          <MarkdownContent content={thought} variant="assistant" />
        </div>
      </AnimatedCollapse>
    </div>
  );
}
