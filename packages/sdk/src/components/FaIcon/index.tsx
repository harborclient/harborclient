import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { createElement } from '@harborclient/sdk/react';
import type { JSX } from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<FontAwesomeIconProps, 'icon' | 'ref'> {
  /**
   * Font Awesome icon definition registered in the library.
   */
  icon: IconDefinition;
}

/**
 * Renders a Font Awesome SVG icon with consistent default sizing.
 */
export function FaIcon({ icon, className = 'h-3.5 w-3.5', title, ...props }: Props): JSX.Element {
  return createElement(FontAwesomeIcon, {
    ...props,
    icon,
    className: cn('hc-fa-icon', className),
    title,
    'aria-hidden': title ? undefined : true
  });
}
