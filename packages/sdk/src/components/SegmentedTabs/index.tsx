import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, KeyboardEvent } from 'react';
import { VisibilityMenu } from '../VisibilityMenu/index.js';
import { segment, segmentGroup } from '../classes.js';
import { getFocusableElements } from '../useDialogFocus.js';
import { cn, resolveTabListKeyAction } from '../utils.js';
import { SegmentedTabsContext } from './SegmentedTabsContext.js';
import type { TabItem } from './types.js';

export { SegmentedTabsGroup } from './SegmentedTabsGroup.js';
export { SegmentedTabPanel } from './SegmentedTabPanel.js';
export type { TabItem } from './types.js';

/**
 * Returns the tab value whose button currently has keyboard focus.
 *
 * @returns Focused tab value, or undefined when focus is outside the tab buttons.
 */
function getFocusedTabValue<T extends string>(tabRefs: Map<T, HTMLButtonElement>): T | undefined {
  const active = document.activeElement;
  if (active == null) return undefined;

  for (const [tabValue, button] of tabRefs.entries()) {
    if (button === active) return tabValue;
  }

  return undefined;
}

/**
 * Moves focus to the first visible focusable element inside a tab panel.
 *
 * Uses {@link getFocusableElements} first, then falls back to a direct query
 * when layout APIs report no visible descendants (for example in jsdom).
 *
 * @returns True when focus moved into the panel.
 */
function focusFirstFocusableInPanel(panel: HTMLElement | null): boolean {
  if (panel == null) return false;

  let firstFocusable: HTMLElement | undefined = getFocusableElements(panel)[0];

  if (firstFocusable == null) {
    const selector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    firstFocusable =
      Array.from(panel.querySelectorAll<HTMLElement>(selector)).find(
        (element) => !element.closest('[aria-hidden="true"]')
      ) ?? undefined;
  }

  if (firstFocusable == null || typeof firstFocusable.focus !== 'function') {
    return false;
  }

  firstFocusable.focus();
  return true;
}

interface Props<T extends string> extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'className' | 'aria-label' | 'onChange'
> {
  /**
   * Tab definitions to render.
   */
  tabs: TabItem<T>[];

  /**
   * Currently selected tab value. Omit when used inside `SegmentedTabsGroup`.
   */
  value?: T;

  /**
   * Called when the user selects a different tab. Omit when used inside
   * `SegmentedTabsGroup`.
   */
  onChange?: (value: T) => void;

  /**
   * When true, shows a menu for toggling tab visibility.
   */
  editable?: boolean;

  /**
   * Controlled set of tab values shown in the tab strip. Used with
   * `onVisibleTabValuesChange` when tab visibility is persisted.
   */
  visibleTabValues?: T[];

  /**
   * Initial visible tab values for uncontrolled visibility. Defaults to all
   * non-`hidden` tabs. Keep a copy in the parent to reset saved preferences.
   */
  defaultVisibleTabValues?: T[];

  /**
   * Called when the user toggles tab visibility in the edit menu.
   */
  onVisibleTabValuesChange?: (visibleTabValues: T[]) => void;

  /**
   * When true, the group and each tab stretch to full width.
   */
  fullWidth?: boolean;

  /**
   * Additional CSS classes for the tab group container.
   */
  className?: string;

  /**
   * ARIA pattern for the control. Use `radiogroup` for single-choice settings
   * pickers; use `tabs` with `SegmentedTabsGroup` for content switchers.
   */
  pattern?: 'tabs' | 'radiogroup';

  /**
   * Accessible name for the tab list or radio group. Omit when used inside
   * `SegmentedTabsGroup`.
   */
  ariaLabel?: string;
}

/**
 * macOS-style segmented tab control with WAI-ARIA tabs or radiogroup semantics.
 * The tab strip wraps to additional rows when tabs exceed the container width.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value: valueProp,
  onChange: onChangeProp,
  editable = true,
  visibleTabValues: visibleTabValuesProp,
  defaultVisibleTabValues,
  onVisibleTabValuesChange,
  fullWidth = false,
  className,
  pattern = 'tabs',
  ariaLabel: ariaLabelProp,
  ...props
}: Props<T>): JSX.Element {
  const context = useContext(SegmentedTabsContext);
  const standaloneId = useId();
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

  const value = (context?.value as T | undefined) ?? valueProp;

  /**
   * Resolves the change handler from group context or standalone props so the
   * keyboard handler dependency stays stable across renders.
   */
  const onChange = useMemo((): ((nextValue: T) => void) | undefined => {
    if (context) return (nextValue) => context.onChange(nextValue);
    return onChangeProp;
  }, [context, onChangeProp]);
  const ariaLabel = context?.ariaLabel ?? ariaLabelProp;

  if (value === undefined || onChange === undefined) {
    throw new Error(
      'SegmentedTabs requires value and onChange, or must be used within SegmentedTabsGroup'
    );
  }

  const getTabId = context
    ? (tabValue: T) => context.getTabId(tabValue)
    : (tabValue: T) => `${standaloneId}-tab-${tabValue}`;
  const getPanelId = context
    ? (tabValue: T) => context.getPanelId(tabValue)
    : (tabValue: T) => `${standaloneId}-panel-${tabValue}`;

  const editableTabs = useMemo(() => tabs.filter((tab) => !tab.hidden), [tabs]);
  const defaultVisible = useMemo(
    () => defaultVisibleTabValues ?? editableTabs.map((tab) => tab.value),
    [defaultVisibleTabValues, editableTabs]
  );

  const [internalVisibleTabValues, setInternalVisibleTabValues] = useState<T[]>(defaultVisible);
  const visibleTabValues = visibleTabValuesProp ?? internalVisibleTabValues;
  const visibleSet = useMemo(() => new Set(visibleTabValues), [visibleTabValues]);

  const visibleTabs = editable
    ? editableTabs.filter((tab) => visibleSet.has(tab.value))
    : editableTabs;

  /**
   * Updates visible tab values and notifies the parent when controlled props
   * are used for persistence.
   */
  const updateVisibleTabValues = useCallback(
    (nextVisibleTabValues: T[]): void => {
      if (visibleTabValuesProp === undefined) {
        setInternalVisibleTabValues(nextVisibleTabValues);
      }
      onVisibleTabValuesChange?.(nextVisibleTabValues);
    },
    [onVisibleTabValuesChange, visibleTabValuesProp]
  );

  /**
   * Toggles a tab's visibility in the edit menu, keeping at least one tab
   * visible and moving selection when the active tab is hidden.
   */
  const handleVisibilityToggle = useCallback(
    (tabValue: T): void => {
      const isVisible = visibleSet.has(tabValue);
      if (isVisible && visibleTabs.length <= 1) return;

      const nextVisibleSet = new Set(visibleTabValues);
      if (isVisible) {
        nextVisibleSet.delete(tabValue);
      } else {
        nextVisibleSet.add(tabValue);
      }

      const nextVisibleTabValues = editableTabs
        .filter((tab) => nextVisibleSet.has(tab.value))
        .map((tab) => tab.value);

      updateVisibleTabValues(nextVisibleTabValues);

      if (isVisible && tabValue === value) {
        const nextSelectedTab = editableTabs.find((tab) => nextVisibleSet.has(tab.value));
        if (nextSelectedTab) {
          onChange(nextSelectedTab.value);
        }
      }
    },
    [
      editableTabs,
      onChange,
      updateVisibleTabValues,
      value,
      visibleSet,
      visibleTabValues,
      visibleTabs.length
    ]
  );

  /**
   * When visibility changes externally, select the first visible tab if the
   * current selection is hidden.
   */
  useEffect(() => {
    if (!editable || visibleSet.has(value)) return;

    const nextSelectedTab = visibleTabs[0];
    if (nextSelectedTab) {
      onChange(nextSelectedTab.value);
    }
  }, [editable, onChange, value, visibleSet, visibleTabs]);

  const outerClassName = cn(
    'hc-segmented-tabs',
    segmentGroup,
    'items-start gap-1',
    fullWidth ? 'min-w-0 flex-1' : '',
    className
  );

  const tabListClassName = cn(
    'hc-segmented-tabs-list flex w-full min-w-0 flex-1 flex-wrap items-center gap-y-2'
  );

  const isRadiogroup = pattern === 'radiogroup';

  /**
   * Moves selection with arrow, Home, and End keys and focuses the newly
   * selected tab or radio control. ArrowDown on a focused tab moves focus into
   * the linked tab panel when used inside `SegmentedTabsGroup`.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'ArrowDown' && !isRadiogroup && context) {
        const focusedTabValue = getFocusedTabValue(tabRefs.current);
        if (focusedTabValue !== undefined) {
          event.preventDefault();

          /**
           * Focuses the first focusable control in the panel for the focused tab.
           */
          const focusPanel = (): void => {
            const panel = document.getElementById(getPanelId(focusedTabValue));
            if (panel instanceof HTMLElement) {
              focusFirstFocusableInPanel(panel);
            }
          };

          if (focusedTabValue !== value) {
            onChange(focusedTabValue);
            requestAnimationFrame(() => {
              requestAnimationFrame(focusPanel);
            });
          } else {
            requestAnimationFrame(focusPanel);
          }

          return;
        }
      }

      const currentIndex = visibleTabs.findIndex((tab) => tab.value === value);
      const disabledIndices = visibleTabs
        .map((tab, index) => (tab.disabled ? index : -1))
        .filter((index) => index >= 0);

      const nextIndex = resolveTabListKeyAction(event.key, currentIndex, visibleTabs.length, {
        disabledIndices
      });
      if (nextIndex === null) return;

      event.preventDefault();
      const nextTab = visibleTabs[nextIndex];
      if (nextTab.value !== value) {
        onChange(nextTab.value);
      }

      requestAnimationFrame(() => {
        tabRefs.current.get(nextTab.value)?.focus();
      });
    },
    [visibleTabs, value, onChange, isRadiogroup, context, getPanelId]
  );

  return (
    <div {...props} className={outerClassName}>
      <div
        className={tabListClassName}
        role={isRadiogroup ? 'radiogroup' : 'tablist'}
        aria-label={ariaLabel}
        {...(!isRadiogroup ? { 'aria-orientation': 'horizontal' as const } : {})}
        onKeyDown={handleKeyDown}
      >
        {visibleTabs.map((tab) => {
          const selected = value === tab.value;
          const tabClassName = `hc-segmented-tabs-tab flex items-center justify-center ${segment(selected)}${
            fullWidth ? ' flex-1' : ''
          }`;

          return (
            <button
              key={tab.value}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.value, element);
                else tabRefs.current.delete(tab.value);
              }}
              type="button"
              className={tabClassName}
              disabled={tab.disabled}
              tabIndex={tab.disabled ? -1 : 0}
              onClick={() => onChange(tab.value)}
              {...(isRadiogroup
                ? { role: 'radio', 'aria-checked': selected }
                : {
                    role: 'tab',
                    id: getTabId(tab.value),
                    'aria-selected': selected,
                    ...(context ? { 'aria-controls': getPanelId(tab.value) } : {})
                  })}
            >
              <span className="hc-segmented-tabs-tab-label inline-flex items-center justify-center gap-1.5">
                <span className="inline-flex shrink-0 items-center px-1.5">
                  <span
                    className={cn(
                      'hc-segmented-tabs-tab-indicator h-1.5 w-1.5 shrink-0 rounded-full',
                      tab.indicator ? 'bg-accent' : 'bg-transparent'
                    )}
                    aria-hidden
                  />
                </span>
                {tab.label}
                <span
                  className="hc-segmented-tabs-tab-indicator-spacer inline-flex shrink-0 items-center px-1.5"
                  aria-hidden
                >
                  <span className="h-1.5 w-1.5 shrink-0" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {editable && (
        <VisibilityMenu
          items={editableTabs}
          visibleValues={visibleTabValues}
          onToggle={handleVisibilityToggle}
        />
      )}
    </div>
  );
}
