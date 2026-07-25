import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { cn } from '../utils.js';
import { Body } from './Body.js';
import { Image } from './Image.js';

interface Props extends ComponentPropsWithoutRef<'div'> {
  /**
   */
  children: ReactNode;
}

/**
 * Renders a card with an image, title, and description.
 */
export function Card({ children, className, ...props }: Props): JSX.Element {
  const classes = cn(
    'hc-card flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-separator bg-control',
    className
  );

  return (
    <div {...props} className={classes}>
      {children}
    </div>
  );
}

Card.Body = Body;
Card.Image = Image;
