import type { JSX } from 'react';

/**
 * Full-width hairline between HTTP methods and SSE in the method listbox.
 *
 * Uses the theme separator token so the divider matches other menus and borders.
 *
 * @returns Decorative separator row excluded from the accessibility tree.
 */
export function MethodSelectSeparator(): JSX.Element {
  return <div className="my-1 border-t border-separator" role="presentation" aria-hidden="true" />;
}
