import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { GitAuthorForm } from '#/renderer/src/ui/git/GitAuthorForm';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';

interface Props {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Git connection id for repo-local author suggestion lookup.
   */
  connectionId: string;

  /**
   * Called when the modal should close without saving.
   */
  onClose: () => void;

  /**
   * Called after the author is saved successfully.
   */
  onSaved: () => void;
}

/**
 * Prompts for commit author details before the first HarborClient commit.
 */
export function GitCommitAuthorModal({
  open,
  connectionId,
  onClose,
  onSaved
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const userEditedRef = useRef(false);

  /**
   * Loads suggested author values when the modal opens.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    userEditedRef.current = false;
    let cancelled = false;

    void window.api.gitSuggestedAuthor(connectionId).then((suggested) => {
      if (cancelled || userEditedRef.current) {
        return;
      }
      setName(suggested.name);
      setEmail(suggested.email);
    });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId]);

  /**
   * Clears draft state and closes the modal.
   */
  const handleClose = useCallback((): void => {
    setName('');
    setEmail('');
    setBusy(false);
    userEditedRef.current = false;
    onClose();
  }, [onClose]);

  /**
   * Persists the author and continues the pending commit flow.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      await dispatch(
        patchGeneralSettings({
          gitCommitAuthorName: name.trim(),
          gitCommitAuthorEmail: email.trim(),
          gitCommitAuthorPrompted: true
        })
      );
      setName('');
      setEmail('');
      setBusy(false);
      userEditedRef.current = false;
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [dispatch, email, name, onSaved]);

  /**
   * Marks the draft as user-edited so async prefill cannot overwrite input.
   */
  const handleNameChange = useCallback((value: string): void => {
    userEditedRef.current = true;
    setName(value);
  }, []);

  /**
   * Marks the draft as user-edited so async prefill cannot overwrite input.
   */
  const handleEmailChange = useCallback((value: string): void => {
    userEditedRef.current = true;
    setEmail(value);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={handleClose}
      className="w-[32rem]"
      labelledBy="git-commit-author-title"
      title="Set commit author"
      description="Choose the name and email HarborClient stamps on your commits. Leave blank to use HarborClient defaults."
    >
      <GitAuthorForm
        name={name}
        email={email}
        disabled={busy}
        onNameChange={handleNameChange}
        onEmailChange={handleEmailChange}
      />

      <ModalFooter spaced>
        <Button type="button" variant="secondary" disabled={busy} onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" disabled={busy} onClick={() => void handleSave()}>
          Save and commit
        </Button>
      </ModalFooter>
    </Modal>
  );
}
