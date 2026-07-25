import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';
import { Button } from '../Button/index.js';
import { FieldError } from '../FieldError/index.js';
import { cn } from '../utils.js';

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Error message shown beside the retry control.
   */
  error: ReactNode;

  /**
   * Called when the user activates the retry button.
   */
  onRetry: () => void;

  /**
   * Accessible label for the retry button.
   */
  retryLabel?: string;
}

/**
 * Inline error message paired with a secondary retry button.
 */
export function ErrorRetry({
  error,
  onRetry,
  retryLabel = 'Retry',
  className,
  ...props
}: Props): JSX.Element {
  return (
    <div {...props} className={cn('hc-error-retry flex flex-wrap items-center gap-2', className)}>
      <FieldError spacing="field" className="hc-error-retry-message mt-0 mb-0">
        {error}
      </FieldError>
      <Button type="button" variant="secondary" className="hc-error-retry-button" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
