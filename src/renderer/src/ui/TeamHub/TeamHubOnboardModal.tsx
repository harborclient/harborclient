import { useCallback, useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { HubInvitationPreview } from '#/shared/types';
import {
  Badge,
  Button,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout
} from '@harborclient/sdk/components';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { createBlankTeamHub } from '#/renderer/src/ui/TeamHub/constants';

interface Props {
  /**
   * Team Hub server base URL from the join deep link.
   */
  baseUrl: string;

  /**
   * Invitation secret prefixed with `hbi_`.
   */
  code: string;

  /**
   * Closes the onboarding modal without saving a connection.
   */
  onClose: () => void;
}

/**
 * Guided modal that previews, redeems, and saves a Team Hub connection from a join deep link.
 */
export function TeamHubOnboardModal({ baseUrl, code, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [preview, setPreview] = useState<HubInvitationPreview | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads invitation preview details for operator confirmation.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) {
          return;
        }
        setLoadingPreview(true);
        setError(null);
        return window.api.previewTeamHubInvitation(baseUrl, code);
      })
      .then((result) => {
        if (cancelled || result === undefined) {
          return;
        }
        setPreview(result);
        setConnectionName(result.user.name);
        setLoadingPreview(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, code]);

  /**
   * Redeems the invitation, verifies the issued token, and saves the new connection.
   */
  const handleJoin = useCallback(async (): Promise<void> => {
    if (!preview || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const redeemed = await window.api.redeemTeamHubInvitation(
        baseUrl,
        code,
        `${preview.user.name} onboarding`
      );
      const hub = {
        ...createBlankTeamHub(),
        name: connectionName.trim() || preview.user.name,
        baseUrl,
        token: redeemed.secret
      };
      await window.api.saveTeamHub(hub);
      await dispatch(refreshCollections());
      await dispatch(refreshHubLlmModels());
      toast.success('Team Hub connection added.');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [baseUrl, code, connectionName, dispatch, onClose, preview, saving]);

  const httpWarning =
    baseUrl.startsWith('http://') && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl)
      ? 'This Team Hub uses HTTP. Your API token will be sent in cleartext over the network.'
      : null;

  return (
    <Modal
      className="w-[520px]"
      overlayClassName="z-[60]"
      labelledBy="team-hub-onboard-title"
      onClose={onClose}
      title="Join Team Hub"
      description="Confirm the invited account details, then add this Team Hub to HarborClient."
      closeDisabled={saving}
      disableEscape={saving || loadingPreview}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : null}
        actions={
          <Button
            type="button"
            disabled={loadingPreview || saving || !preview}
            onClick={() => void handleJoin()}
          >
            {saving ? 'Joining…' : 'Join Team Hub'}
          </Button>
        }
      >
        <FormGroup label="Team hub URL" htmlFor="team-hub-onboard-url">
          <Input id="team-hub-onboard-url" type="url" variant="surface" readOnly value={baseUrl} />
        </FormGroup>

        {loadingPreview ? (
          <p className="text-[14px] text-muted">Loading invitation details…</p>
        ) : preview ? (
          <>
            <div className="flex items-center gap-2 text-[14px]">
              <span className="font-medium">{preview.user.name}</span>
              <Badge variant="success">{preview.user.role}</Badge>
            </div>
            <p className="text-[13px] text-muted">
              Invitation expires {new Date(preview.expiresAt).toLocaleString()}.
            </p>
            <FormGroup label="Connection name" htmlFor="team-hub-onboard-name">
              <Input
                id="team-hub-onboard-name"
                type="text"
                variant="surface"
                value={connectionName}
                disabled={saving}
                onChange={(event) => setConnectionName(event.target.value)}
              />
            </FormGroup>
          </>
        ) : null}

        {httpWarning ? (
          <p className="text-[13px] text-warning" role="status">
            {httpWarning}
          </p>
        ) : null}
      </ModalFormLayout>
    </Modal>
  );
}
