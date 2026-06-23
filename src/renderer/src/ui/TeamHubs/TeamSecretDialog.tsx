import { useState, type JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';

interface Props {
  /**
   * Dialog title shown above the secret value.
   */
  title: string;

  /**
   * Explanatory text describing why the secret is shown once.
   */
  description: string;

  /**
   * One-time bearer token secret to display.
   */
  secret: string;

  /**
   * Closes the dialog after the operator acknowledges the secret.
   */
  onClose: () => void;
}

/**
 * Modal that displays a one-time API token secret with copy support.
 */
export function TeamSecretDialog({ title, description, secret, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the token secret to the clipboard and shows brief confirmation.
   */
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[520px] rounded-lg border border-separator bg-surface p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-secret-dialog-title"
      >
        <h2 id="team-secret-dialog-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
          {title}
        </h2>
        <p className="mb-4 text-[14px] text-muted">{description}</p>

        <label htmlFor="team-secret-value" className="mb-1 block text-[14px] font-medium text-text">
          Token secret
        </label>
        <textarea
          id="team-secret-value"
          readOnly
          className="h-24 w-full resize-none rounded-md border border-separator bg-surface px-3 py-2 font-mono text-[13px] text-text"
          value={secret}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
