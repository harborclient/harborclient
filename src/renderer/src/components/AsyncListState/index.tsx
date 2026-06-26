import type { JSX, ReactNode } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FieldError } from '#/renderer/src/components/FieldError';

interface LoadingMessageProps {
  /**
   * Loading text announced to assistive technologies.
   */
  children?: ReactNode;

  /**
   * Additional Tailwind classes merged onto the status paragraph.
   */
  className?: string;
}

/**
 * Muted loading label used while async list data is fetched.
 *
 * @param children - Loading message; defaults to "Loading…".
 * @param className - Extra classes appended after the preset.
 */
export function LoadingMessage({
  children = 'Loading…',
  className
}: LoadingMessageProps): JSX.Element {
  const base = 'text-[14px] text-muted';
  const classes = className ? `${base} ${className}` : base;

  return (
    <p role="status" className={classes}>
      {children}
    </p>
  );
}

interface ErrorRetryProps {
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
 *
 * @param error - Error text rendered in danger color.
 * @param onRetry - Handler invoked when retry is clicked.
 * @param retryLabel - Visible retry button label.
 */
export function ErrorRetry({ error, onRetry, retryLabel = 'Retry' }: ErrorRetryProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FieldError spacing="field" className="mb-0 mt-0">
        {error}
      </FieldError>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

interface AsyncListStateProps {
  /**
   * When true, renders the loading placeholder instead of children.
   */
  loading: boolean;

  /**
   * When set, renders an error row with optional retry instead of children.
   */
  error?: ReactNode;

  /**
   * Called when the user activates retry on the error row.
   */
  onRetry?: () => void;

  /**
   * Message shown when the list is empty and not loading or errored.
   */
  emptyMessage?: ReactNode;

  /**
   * Whether the underlying collection is empty.
   */
  isEmpty?: boolean;

  /**
   * List content rendered when data is ready.
   */
  children: ReactNode;

  /**
   * Custom loading message; defaults to {@link LoadingMessage}.
   */
  loadingMessage?: ReactNode;
}

/**
 * Switches between loading, error-with-retry, empty, and ready list content for
 * async CRUD screens such as Team Hub and storage location lists.
 *
 * @param loading - Whether data is still loading.
 * @param error - Optional fetch error message.
 * @param onRetry - Retry handler shown when `error` is set.
 * @param emptyMessage - Placeholder when `isEmpty` is true.
 * @param isEmpty - Whether the loaded collection has no items.
 * @param children - Ready-state list markup.
 * @param loadingMessage - Optional override for the loading placeholder.
 */
export function AsyncListState({
  loading,
  error,
  onRetry,
  emptyMessage,
  isEmpty = false,
  children,
  loadingMessage
}: AsyncListStateProps): JSX.Element {
  if (loading) {
    return <>{loadingMessage ?? <LoadingMessage />}</>;
  }

  if (error) {
    if (onRetry) {
      return <ErrorRetry error={error} onRetry={onRetry} />;
    }
    return <FieldError spacing="section">{error}</FieldError>;
  }

  if (isEmpty && emptyMessage != null) {
    return <p className="text-[14px] text-muted">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
