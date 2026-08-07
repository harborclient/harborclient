import { useId, useState, type JSX, type FormEvent } from 'react';
import { Button, Textarea } from '@harborclient/sdk/components';

interface Props {
  /**
   * Accessible label for the composer textarea.
   */
  label: string;

  /**
   * Submit button label.
   */
  submitLabel?: string;

  /**
   * Placeholder shown in the empty composer.
   */
  placeholder?: string;

  /**
   * Disables editing and submission.
   */
  disabled?: boolean;

  /**
   * Called with trimmed comment text when the user submits the form.
   *
   * @param body - Non-empty comment body.
   */
  onSubmit: (body: string) => Promise<void>;
}

/**
 * Accessible single-comment editor used for new comments and inline replies.
 */
export function DiscussionComposer({
  label,
  submitLabel = 'Post',
  placeholder = 'Write a comment…',
  disabled = false,
  onSubmit
}: Props): JSX.Element {
  const textareaId = useId();
  const errorId = `${textareaId}-error`;
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Validates and posts the composer contents.
   *
   * @param event - Form submit event from the composer.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Enter a comment before posting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = disabled || submitting;

  return (
    <form className="flex min-w-0 flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor={textareaId} className="font-medium">
        {label}
      </label>
      <Textarea
        id={textareaId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={3}
        aria-invalid={error != null}
        aria-describedby={error != null ? errorId : undefined}
      />
      {error != null ? (
        <p id={errorId} className="m-0 text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isDisabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
