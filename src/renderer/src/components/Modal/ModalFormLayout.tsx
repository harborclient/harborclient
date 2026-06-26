import type { JSX, ReactNode } from 'react';
import { ModalFooter } from '#/renderer/src/components/Modal/ModalFooter';

interface Props {
  /**
   * Primary modal body content such as form fields or descriptive text.
   */
  children: ReactNode;

  /**
   * Optional error message rendered above the action row.
   */
  error?: ReactNode;

  /**
   * Action buttons; wrapped in {@link ModalFooter} when provided.
   */
  actions?: ReactNode;

  /**
   * When true, adds top margin on the action footer row.
   */
  actionsSpaced?: boolean;
}

/**
 * Stacks modal body content, an optional error block, and a trailing action footer
 * using the shared spacing conventions used across Team Hub and settings dialogs.
 *
 * @param children - Main modal content.
 * @param error - Optional inline error rendered before actions.
 * @param actions - Footer buttons wrapped by {@link ModalFooter}.
 * @param actionsSpaced - Whether the footer row receives `mt-4`.
 */
export function ModalFormLayout({
  children,
  error,
  actions,
  actionsSpaced = true
}: Props): JSX.Element {
  return (
    <>
      {children}
      {error}
      {actions ? <ModalFooter spaced={actionsSpaced}>{actions}</ModalFooter> : null}
    </>
  );
}
