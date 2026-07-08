import {
  OverlayScrollbarsComponent,
  type OverlayScrollbarsComponentProps
} from 'overlayscrollbars-react';
import type { PartialOptions, ScrollbarsAutoHideBehavior } from 'overlayscrollbars';
import { useMemo, type JSX, type ReactNode } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectScrollbarAutoHide } from '#/renderer/src/store/slices/settingsSlice';

/**
 * Scroll axis configuration for the HarborClient scrollbar wrapper.
 */
export type ScrollbarsAxis = 'vertical' | 'horizontal' | 'both';

interface Props extends Omit<OverlayScrollbarsComponentProps, 'options' | 'children'> {
  /**
   * Which axes should scroll when content overflows.
   */
  axis?: ScrollbarsAxis;

  /**
   * Content rendered inside the scrollable viewport.
   */
  children: ReactNode;

  /**
   * Optional OverlayScrollbars overrides merged on top of HarborClient defaults.
   */
  options?: PartialOptions | false | null;
}

/**
 * Default OverlayScrollbars options shared by HarborClient scroll regions.
 */
const HARBOR_SCROLLBARS_OPTIONS: PartialOptions = {
  scrollbars: {
    theme: 'os-theme-harbor',
    visibility: 'auto',
    autoHideDelay: 800
  }
};

/**
 * Maps the General settings auto-hide preference to OverlayScrollbars behavior.
 *
 * @param enabled - When true, handles fade after scrolling stops.
 * @returns OverlayScrollbars auto-hide mode.
 */
function resolveScrollbarAutoHide(enabled: boolean): ScrollbarsAutoHideBehavior {
  return enabled ? 'scroll' : 'never';
}

/**
 * Maps a scroll axis hint to OverlayScrollbars overflow behavior.
 *
 * @param axis - Requested scroll direction(s).
 * @returns Overflow options for the OverlayScrollbars instance.
 */
function getOverflowOptions(axis: ScrollbarsAxis): PartialOptions['overflow'] {
  switch (axis) {
    case 'horizontal':
      return { x: 'scroll', y: 'hidden' };
    case 'vertical':
      return { x: 'hidden', y: 'scroll' };
    case 'both':
    default:
      return { x: 'scroll', y: 'scroll' };
  }
}

/**
 * Theme-aware scroll container backed by OverlayScrollbars.
 *
 * Uses the `os-theme-harbor` CSS theme so scrollbar colors follow active
 * `--mac-scrollbar-*` tokens from built-in, custom, and plugin themes.
 */
export function Scrollbars({
  axis = 'vertical',
  children,
  className,
  options,
  ...rest
}: Props): JSX.Element {
  const scrollbarAutoHide = useAppSelector(selectScrollbarAutoHide);

  /**
   * Merges HarborClient defaults with per-instance overflow and caller overrides.
   */
  const mergedOptions = useMemo<PartialOptions>(() => {
    const baseScrollbars = HARBOR_SCROLLBARS_OPTIONS.scrollbars ?? {};
    const overrideScrollbars =
      options && typeof options === 'object' ? (options.scrollbars ?? {}) : {};
    const axisOverflow = getOverflowOptions(axis);
    const overrideOverflow = options && typeof options === 'object' ? options.overflow : undefined;

    const autoHide = axis === 'horizontal' ? 'never' : resolveScrollbarAutoHide(scrollbarAutoHide);

    return {
      ...HARBOR_SCROLLBARS_OPTIONS,
      ...options,
      overflow: overrideOverflow ? { ...axisOverflow, ...overrideOverflow } : axisOverflow,
      scrollbars: {
        ...baseScrollbars,
        autoHide,
        ...overrideScrollbars
      }
    };
  }, [axis, options, scrollbarAutoHide]);

  return (
    <OverlayScrollbarsComponent className={className} options={mergedOptions} {...rest}>
      {children}
    </OverlayScrollbarsComponent>
  );
}
