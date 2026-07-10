import { useCallback, useState, type JSX } from 'react';
import { parseTeamHubInviteLink } from '#/shared/deepLink';
import {
  Button,
  FieldError,
  FormGroup,
  Modal,
  ModalFooter,
  Textarea
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeAcceptTeamHubInviteModal,
  selectAcceptTeamHubInviteModal
} from '#/renderer/src/store/slices/modalsSlice';
import { setPendingTeamHubJoin } from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

const INVITE_INPUT_ID = 'accept-team-hub-invite-input';
const INVITE_ERROR_ID = 'accept-team-hub-invite-error';

const INVALID_INVITE_MESSAGE =
  "That doesn't look like a valid Team Hub invite link. Paste the full https://.../join link you received.";

/**
 * Modal that accepts a pasted Team Hub invitation link and hands off to the join flow.
 */
export function AcceptTeamHubInviteModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const acceptTeamHubInviteModal = useAppSelector(selectAcceptTeamHubInviteModal);
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Closes the modal and clears the pasted invite input.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeAcceptTeamHubInviteModal());
    setInviteInput('');
    setError(null);
  }, [dispatch]);

  /**
   * Parses the pasted invite link and queues the Team Hub onboarding modal.
   */
  const handleAccept = useCallback((): void => {
    const trimmed = inviteInput.trim();
    if (!trimmed) {
      setError(INVALID_INVITE_MESSAGE);
      return;
    }

    const payload = parseTeamHubInviteLink(trimmed);
    if (!payload) {
      setError(INVALID_INVITE_MESSAGE);
      return;
    }

    dispatch(openPageTab({ type: 'team-hubs' }));
    dispatch(
      setPendingTeamHubJoin({
        baseUrl: payload.baseUrl,
        code: payload.code,
        name: payload.name,
        role: payload.role,
        expiresAt: payload.expiresAt,
        hubName: payload.hubName,
        accessSummary: payload.accessSummary
      })
    );
    handleClose();
  }, [dispatch, handleClose, inviteInput]);

  if (!acceptTeamHubInviteModal) {
    return null;
  }

  return (
    <Modal
      className="w-[560px]"
      overlayClassName="z-[60]"
      labelledBy="accept-team-hub-invite-title"
      onClose={handleClose}
      title="Accept Team Hub Invite"
      description="Paste the https:// invitation link you received from a Team Hub administrator."
    >
      <FormGroup label="Invitation link" htmlFor={INVITE_INPUT_ID}>
        <Textarea
          id={INVITE_INPUT_ID}
          autoFocus
          variant="surface"
          className="min-h-28 resize-y font-mono text-[14px]"
          placeholder="https://teamhub.example.com/join?...#code=hbi_..."
          value={inviteInput}
          aria-invalid={error != null}
          aria-describedby={error != null ? INVITE_ERROR_ID : undefined}
          onChange={(event) => {
            setInviteInput(event.target.value);
            if (error != null) {
              setError(null);
            }
          }}
        />
      </FormGroup>

      {error ? (
        <FieldError id={INVITE_ERROR_ID} spacing="section" className="mt-3">
          {error}
        </FieldError>
      ) : null}

      <ModalFooter spaced>
        <Button type="button" disabled={!inviteInput.trim()} onClick={handleAccept}>
          Accept invite
        </Button>
      </ModalFooter>
    </Modal>
  );
}
