import type { ComponentPropsWithoutRef, JSX } from 'react';
import { cn } from '../utils.js';

type Props = ComponentPropsWithoutRef<'img'>;

/**
 * Renders a card image.
 */
export function Image({ src, alt, className, ...props }: Props): JSX.Element {
  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={cn('hc-card-image h-full w-full max-w-full object-cover', className)}
    />
  );
}
