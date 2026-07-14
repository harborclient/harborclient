/**
 * Shared macOS-style Tailwind class strings.
 */

import {
  METHOD_CLASSES,
  sourceRow,
  statusDotClass,
  tabItem as requestTabItem
} from '@harborclient/sdk/components';

export { requestTabItem, sourceRow, METHOD_CLASSES, statusDotClass };

export const separator = 'h-px bg-separator';

export const sectionLabel = 'mb-1 px-2 text-[14px] font-medium uppercase tracking-wide text-muted';

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
  'inline-flex min-w-0 items-center rounded-md p-0.5 shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag';

/**
 * Compact inset capsule for sidebar count badges (e.g. git uncommitted changes).
 * Fill uses the recessed selection tone so git text tokens remain available for request names.
 */
export const sidebarRecessedBadge =
  'inline-flex h-[18px] min-w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-selection px-2 text-[14px] leading-none text-muted shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent app-no-drag';

/**
 * Inset status panel for git branch and working-tree summary in the Changes section.
 * Uses sidebar-toolbar tone so it reads as content, not a second section header.
 */
export const gitWorkingTreeStatusPanel =
  'bg-sidebar-toolbar px-2 py-2 border-b border-separator mb-2';

/**
 * Always-on accent highlight for the footer's Action menu toggle — flush against
 * the footer's left edge and stretched to its full height, distinct from the
 * other footer toggles which only highlight while active.
 *
 * @param active - Whether the Action menu is currently open.
 */
export function actionMenuToggleClass(active: boolean): string {
  const base =
    'hc-action-menu-toggle flex shrink-0 cursor-pointer items-center justify-center self-stretch bg-accent px-2.5 text-white app-no-drag';
  return active ? `${base} shadow-inner` : `${base} hover:brightness-110`;
}
