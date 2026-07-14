import { Scrollbars as SdkScrollbars, type ScrollbarsAxis } from '@harborclient/sdk/components';
import type { OverlayScrollbarsComponentProps } from 'overlayscrollbars-react';
import type { PartialOptions } from 'overlayscrollbars';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectScrollbarAutoHide } from '#/renderer/src/store/slices/settingsSlice';
import { useMemo, type JSX, type ReactNode } from 'react';

export type { ScrollbarsAxis };

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
 * Theme-aware scroll container backed by the SDK OverlayScrollbars wrapper.
 *
 * Reads the General settings auto-hide preference from Redux and passes it to
 * the SDK `Scrollbars` component.
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
   * Forwards HarborClient scrollbar settings to the SDK wrapper.
   */
  const autoHide = useMemo(() => scrollbarAutoHide, [scrollbarAutoHide]);

  return (
    <SdkScrollbars
      axis={axis}
      autoHide={autoHide}
      className={className}
      options={options}
      {...rest}
    >
      {children}
    </SdkScrollbars>
  );
}
