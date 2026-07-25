import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { AriaAttributes, ComponentPropsWithoutRef, JSX, ReactNode, RefObject } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { cn } from '../utils.js';

/**
 * Declarative action rendered as an icon button in a sidebar toolbar.
 */
export interface ToolbarAction {
  /**
   * Stable React key for this action.
   */
  id: string;

  /**
   * Font Awesome icon shown inside the action button.
   */
  icon: IconDefinition;

  /**
   * Accessible name for the control.
   */
  label: string;

  /**
   * Native tooltip text; defaults to `label`.
   */
  title?: string;

  /**
   * Called when the user activates the action button.
   */
  onClick: () => void;

  /**
   * When true, the action button is inactive.
   */
  disabled?: boolean;

  /**
   * Exposes toggle state for popup actions such as history menus.
   */
  ariaExpanded?: boolean;

  /**
   * Exposes pressed state for toggle actions such as visibility switches.
   */
  ariaPressed?: boolean;

  /**
   * Indicates the action opens a popup, for example `"menu"`.
   */
  ariaHaspopup?: AriaAttributes['aria-haspopup'];

  /**
   * Optional popover content anchored below this action button.
   */
  popover?: ReactNode;

  /**
   * Ref attached to the action button for portaled popover positioning.
   */
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'aria-label'> {
  /**
   * Icon actions rendered left-aligned in the toolbar.
   */
  actions: ToolbarAction[];

  /**
   * Icon actions rendered right-aligned in the toolbar (e.g. toggles).
   */
  toggles?: ToolbarAction[];

  /**
   * Accessible name for the toolbar landmark.
   */
  ariaLabel?: string;
}

/**
 * Whether a toolbar action is in an active visual state.
 *
 * Toggle actions use `ariaPressed`; popup actions such as chat history use
 * `ariaExpanded` when their menu is open.
 *
 * @param action - Declarative toolbar action to evaluate.
 * @returns True when the action should render with the active background.
 */
function isToolbarActionActive(action: ToolbarAction): boolean {
  return action.ariaPressed === true || action.ariaExpanded === true;
}

/**
 * Tailwind classes for toolbar icon action buttons.
 *
 * Active buttons use `bg-sidebar-section` so they match collection sidebar
 * section headers, and `text-toolbar-action-active` for the pressed icon color.
 * Inactive buttons keep `bg-selection` for hover/focus feedback.
 *
 * @param active - Whether the action is pressed or has an open popup.
 * @returns Class string for the action button.
 */
function toolbarActionButtonClasses(active: boolean): string {
  return cn(
    'hc-toolbar-action app-no-drag inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none',
    active
      ? 'bg-sidebar-section text-toolbar-action-active'
      : 'bg-transparent text-text hover:bg-selection focus-visible:bg-selection focus-visible:text-text',
    'disabled:cursor-not-allowed disabled:opacity-50'
  );
}

/**
 * Renders a single toolbar icon action with optional popover content.
 *
 * @param action - Declarative action to render as an icon button.
 * @returns Toolbar action button wrapped with optional popover anchor.
 */
function renderAction(action: ToolbarAction): JSX.Element {
  const title = action.title ?? action.label;
  const active = isToolbarActionActive(action);

  return (
    <div key={action.id} className="hc-toolbar-action-wrap relative">
      <button
        type="button"
        ref={action.buttonRef}
        className={toolbarActionButtonClasses(active)}
        title={title}
        aria-label={action.label}
        aria-expanded={action.ariaExpanded}
        aria-pressed={action.ariaPressed}
        aria-haspopup={action.ariaHaspopup}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        <FaIcon
          icon={action.icon}
          className={cn('hc-toolbar-action-icon h-5! w-5!', active ? 'opacity-100' : 'opacity-50')}
        />
      </button>
      {action.popover}
    </div>
  );
}

/**
 * Top-of-sidebar toolbar with left-aligned actions and optional right-aligned toggles.
 */
export function Toolbar({
  actions,
  toggles,
  ariaLabel = 'Toolbar',
  className,
  ...props
}: Props): JSX.Element {
  return (
    <div
      {...props}
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'hc-toolbar app-no-drag flex shrink-0 items-center border-b border-separator bg-sidebar-toolbar px-2 py-2',
        className
      )}
    >
      <div className="hc-toolbar-actions flex items-center gap-1 leading-none">
        {actions.map(renderAction)}
      </div>
      {toggles && toggles.length > 0 ? (
        <div className="hc-toolbar-toggles ml-auto flex items-center gap-1">
          {toggles.map(renderAction)}
        </div>
      ) : null}
    </div>
  );
}
