/**
 * Shared macOS-style Tailwind class strings.
 */

import {
  METHOD_CLASSES,
  methodBadgeClass,
  sourceRow,
  statusDotClass,
  statusDotVariant,
  tabItem as requestTabItem
} from '@harborclient/sdk/components';

export {
  requestTabItem,
  sourceRow,
  METHOD_CLASSES,
  methodBadgeClass,
  statusDotClass,
  statusDotVariant
};

export const separator = 'h-px bg-separator';

export const sectionLabel =
  'mb-1 px-2 font-medium uppercase tracking-wide text-muted [font-size:var(--mac-text-font-size-sm)]';

/**
 * Focus ring for read-only elements that participate in Tab order without being buttons.
 */
export const focusableReadonlyClass =
  'rounded-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * Toolbar button styling for destructive row and table actions on full pages.
 */
export const toolbarDangerButtonClass = 'text-danger hover:bg-danger/15';

/**
 * Circular icon control matching document tab close buttons (round hover/focus surface).
 */
export const roundIconButtonClass =
  'hc-tab-close-button focus-visible:bg-selection focus-visible:text-text';

/**
 * Larger circular icon control for pre/post script row header actions.
 */
export const scriptRowIconButtonClass =
  'hc-script-row-icon-button focus-visible:bg-selection focus-visible:text-text';

/**
 * Compact inset container for footer panel toggles and plugin status bar slots.
 * Uses tight padding unlike SDK `segmentGroup`, which targets full-width tab headers.
 */
export const footerButtonGroup =
  'inline-flex min-w-0 items-center rounded-md p-0.5 shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] [border-radius:var(--mac-chrome-radius)]';

/**
 * Inset status panel for git branch and working-tree summary in the Changes section.
 * Uses sidebar-toolbar tone so it reads as content, not a second section header.
 */
export const gitWorkingTreeStatusPanel =
  'hc-git-working-tree-status bg-sidebar-toolbar px-2 py-2 border-b border-separator mb-2';

/**
 * Always-on accent highlight for the footer's Action menu toggle — flush against
 * the footer's left edge and stretched to its full height, distinct from the
 * other footer toggles which only highlight while active. Width matches the
 * collapsed sidebar rail (`w-18`) so the button aligns with the rail.
 *
 * @param active - Whether the Action menu is currently open.
 */
export function actionMenuToggleClass(active: boolean): string {
  const base =
    'hc-action-menu-toggle flex w-18 shrink-0 cursor-pointer items-center justify-center self-stretch bg-accent px-2.5 text-white';
  return active ? `${base} shadow-inner` : `${base} hover:brightness-110`;
}
