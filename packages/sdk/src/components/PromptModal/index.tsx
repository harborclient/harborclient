import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { Button } from '../Button/index.js';
import type { FormGroupLabelTone } from '../FormGroup/index.js';
import { FormGroup } from '../FormGroup/index.js';
import { Modal, ModalFooter } from '../Modal/index.js';
import { Input } from '../forms/index.js';
import { defaultCanSubmitPromptValue } from './promptModal.logic.js';

export interface Props {
  /**
   * Dialog heading rendered in the modal header row.
   */
  title: ReactNode;

  /**
   * Id of the element that labels the dialog (typically the heading).
   */
  labelledBy: string;

  /**
   * Visible field label, or screen-reader-only text when `srOnlyLabel` is set.
   */
  label: ReactNode;

  /**
   * Hides the field label visually while keeping it available to screen readers.
   */
  srOnlyLabel?: boolean;

  /**
   * Label color style for the field. Defaults to muted helper tone.
   */
  labelTone?: FormGroupLabelTone;

  /**
   * Current input value controlled by the parent.
   */
  value: string;

  /**
   * Called when the user edits the input value.
   */
  onChange: (value: string) => void;

  /**
   * Called when the user submits via Enter or the primary button.
   */
  onSubmit: () => void;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;

  /**
   * Primary action button label. Defaults to "Save".
   */
  submitLabel?: string;

  /**
   * Optional placeholder shown when the input is empty.
   */
  placeholder?: string;

  /**
   * Optional muted helper text rendered below the field label.
   */
  description?: ReactNode;

  /**
   * Inline validation or submit error rendered below the input.
   */
  error?: ReactNode;

  /**
   * When true, disables the input and primary button while work is in flight.
   */
  busy?: boolean;

  /**
   * Custom gate for enabling submit and Enter-to-submit. Defaults to non-empty trimmed value.
   */
  canSubmit?: (value: string) => boolean;

  /**
   * Optional width class for the dialog panel (passed to {@link Modal}).
   */
  className?: string;

  /**
   * Explicit id for the text input; used to associate the label via `htmlFor`.
   */
  inputId?: string;

  /**
   * When true, focuses the input when the modal opens. Defaults to true.
   */
  autoFocus?: boolean;
}

/**
 * Single-field prompt modal with autofocus input, Enter-to-submit, inline error,
 * and a primary action gated on a trimmed non-empty value (or custom `canSubmit`).
 */
export function PromptModal({
  title,
  labelledBy,
  label,
  srOnlyLabel = false,
  labelTone = 'muted',
  value,
  onChange,
  onSubmit,
  onClose,
  submitLabel = 'Save',
  placeholder,
  description,
  error,
  busy = false,
  canSubmit = defaultCanSubmitPromptValue,
  className,
  inputId,
  autoFocus = true
}: Props): JSX.Element {
  const submitEnabled = !busy && canSubmit(value);

  /**
   * Submits the prompt when Enter is pressed and submission is allowed.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && submitEnabled) {
      onSubmit();
    }
  };

  return (
    <Modal onClose={onClose} className={className} labelledBy={labelledBy} title={title}>
      <FormGroup
        label={label}
        labelTone={labelTone}
        srOnly={srOnlyLabel}
        htmlFor={inputId}
        description={description}
        error={error}
        className="border-none! p-0!"
      >
        <Input
          className="w-full"
          type="text"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </FormGroup>
      <ModalFooter spaced>
        <Button disabled={!submitEnabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
