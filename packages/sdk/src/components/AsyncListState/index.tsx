import type { JSX, ReactNode } from 'react';
import { FieldError } from '../FieldError/index.js';
import { ErrorRetry } from './ErrorRetry.js';
import { LoadingMessage } from './LoadingMessage.js';

export { ErrorRetry } from './ErrorRetry.js';
export { LoadingMessage } from './LoadingMessage.js';

interface Props {
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
 */
export function AsyncListState({
  loading,
  error,
  onRetry,
  emptyMessage,
  isEmpty = false,
  children,
  loadingMessage
}: Props): JSX.Element {
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
    return <p className="hc-async-list-state-empty text-[14px] text-muted">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
