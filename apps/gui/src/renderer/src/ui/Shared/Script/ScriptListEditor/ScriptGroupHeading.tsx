import { useEffect, useMemo, useRef, type JSX } from 'react';
import {
  FaIcon,
  RowActionsMenu,
  SIDEBAR_CHEVRON_ICON_CLASS,
  SIDEBAR_CHEVRON_SLOT_CLASS,
  type MenuItem
} from '@harborclient/sdk/components';
import {
  SCRIPT_EDITOR_GROUP_HEADINGS,
  type ScriptEditorGroup
} from '@harborclient/core/scriptStage';
import type { ScriptRef } from '@harborclient/core/types';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import {
  SCRIPT_GROUP_ENABLE_LABELS,
  SCRIPT_GROUP_MENU_LABELS,
  scriptGroupEnabledState
} from './helpers';

interface Props {
  /**
   * Editor group whose heading and bulk-enable checkbox are rendered.
   */
  group: ScriptEditorGroup;

  /**
   * Scripts in the group used to derive checkbox checked/indeterminate state.
   */
  scripts: ScriptRef[];

  /**
   * Stable id referenced by the parent section `aria-labelledby`.
   */
  headingId: string;

  /**
   * Id of the collapsible panel this header controls.
   */
  panelId: string;

  /**
   * Whether the group's script list is currently visible.
   */
  expanded: boolean;

  /**
   * Called when the chevron/title control toggles expand/collapse.
   */
  onExpandedChange: (expanded: boolean) => void;

  /**
   * Called when the bulk-enable checkbox toggles all scripts in the group.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Unique id for this section's action menu.
   */
  menuId: string;

  /**
   * Id of the currently open row/section menu, or null when all are closed.
   */
  openMenuId: string | null;

  /**
   * Called when this section menu opens or closes (shared with row menus).
   */
  onOpenChange: (id: string | null) => void;

  /**
   * Grouped menu entries for adding scripts and inserting snippets.
   */
  menuGroups: MenuItem[][];
}

/**
 * Renders a Before/Main/After section header matching collection sidebar chrome:
 * dark band, chevron expand/collapse, bulk-enable checkbox, and hamburger actions.
 */
export function ScriptGroupHeading({
  group,
  scripts,
  headingId,
  panelId,
  expanded,
  onExpandedChange,
  onEnabledChange,
  menuId,
  openMenuId,
  onOpenChange,
  menuGroups
}: Props): JSX.Element {
  const checkboxRef = useRef<HTMLInputElement>(null);
  /**
   * Derives checked vs mixed enablement for the bulk checkbox from the group's rows.
   */
  const enabledState = useMemo(() => scriptGroupEnabledState(scripts), [scripts]);
  const checked = enabledState === 'all' && scripts.length > 0;
  const enableDisabled = scripts.length === 0;
  const menuLabel = SCRIPT_GROUP_MENU_LABELS[group];

  /**
   * Reflects mixed enablement across rows via the native indeterminate checkbox state.
   */
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = enabledState === 'mixed';
    }
  }, [enabledState]);

  return (
    <div className="hc-sidebar-section-header flex min-h-8 items-center justify-between gap-2 border-y border-sidebar-rail-separator bg-sidebar-section py-1 pl-0.5 pr-3">
      <button
        type="button"
        className="app-no-drag inline-flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className={SIDEBAR_CHEVRON_SLOT_CLASS}>
          <FaIcon
            icon={expanded ? faChevronDown : faChevronRight}
            className={`${SIDEBAR_CHEVRON_ICON_CLASS} text-sidebar-section-text`}
          />
        </span>
        <h3
          id={headingId}
          className="m-0 text-[15px] leading-none font-medium tracking-wide text-sidebar-section-text uppercase"
        >
          {SCRIPT_EDITOR_GROUP_HEADINGS[group]}
        </h3>
      </button>
      <div className="hc-sidebar-section-header-actions flex shrink-0 items-center gap-1">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          disabled={enableDisabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          aria-label={SCRIPT_GROUP_ENABLE_LABELS[group]}
          className="shrink-0"
        />
        <RowActionsMenu
          menuId={menuId}
          openMenuId={openMenuId}
          onOpenChange={onOpenChange}
          groups={menuGroups}
          triggerAriaLabel={menuLabel}
          triggerTitle={menuLabel}
        />
      </div>
    </div>
  );
}
