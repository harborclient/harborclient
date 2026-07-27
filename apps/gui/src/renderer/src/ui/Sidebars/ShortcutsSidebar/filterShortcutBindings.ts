import type { ShortcutBinding } from '@harborclient/core/types';
import { formatAcceleratorDisplay } from '@harborclient/core/shortcuts';

/**
 * Filters shortcut bindings by a search query against label and displayed key combination.
 *
 * @param bindings - Resolved shortcut bindings to filter.
 * @param query - User search text; whitespace-only returns all bindings.
 * @returns Bindings whose label or formatted accelerator contains the query.
 */
export function filterShortcutBindings(
  bindings: ShortcutBinding[],
  query: string
): ShortcutBinding[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return bindings;
  }

  return bindings.filter((binding) => {
    const label = binding.label.toLowerCase();
    const accelerator = formatAcceleratorDisplay(binding.accelerator).toLowerCase();
    return label.includes(trimmed) || accelerator.includes(trimmed);
  });
}
