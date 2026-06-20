import type { JSX } from 'react';

/**
 * Renders a section heading for inspector-style panels.
 *
 * @param title - Section title.
 */
export function SectionTitle({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
      {title}
    </h3>
  );
}
