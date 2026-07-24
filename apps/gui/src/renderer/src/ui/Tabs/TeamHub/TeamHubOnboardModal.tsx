import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { hasTeamHubJoinDisplayMetadata } from '#/shared/deepLink';
import type { HubInvitationPreview, TeamHubVerifiedSession } from '#/shared/types';
import type { TeamHubJoinPayload } from '#/renderer/src/store/slices/navigationSlice';
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
import { createBlankTeamHub } from './constants';

interface Props {
  /**
   * Parsed join payload from an HTTPS invite link or harborclient:// deep link.
   */
  join: TeamHubJoinPayload;

  /**
   * Closes the onboarding modal without saving a connection.
   */
  onClose: () => void;
}

/**
 * Builds invitation preview details from link query metadata when available.
 *
 * @param join - Parsed join payload from an invite link.
 */
function buildLinkPreview(join: TeamHubJoinPayload): HubInvitationPreview | null {
  if (!hasTeamHubJoinDisplayMetadata(join) || !join.name || !join.role || !join.expiresAt) {
    return null;
  }

  return {
    user: {
      name: join.name,
      role: join.role,
      collectionAccess: [],
      environmentAccess: [],
      snippetAccess: [],
      llmAccess: false,
      llmModels: []
    },
    expiresAt: join.expiresAt
  };
}

/**
 * Guided modal that confirms invite details, redeems the invitation, and saves the connection.
 */
export function TeamHubOnboardModal({ join, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const linkPreview = useMemo(() => buildLinkPreview(join), [join]);
  const [legacyPreview, setLegacyPreview] = useState<HubInvitationPreview | null>(null);
  const [verifiedSession, setVerifiedSession] = useState<TeamHubVerifiedSession | null>(null);
  const [connectionName, setConnectionName] = useState(join.name ?? join.hubName ?? '');
  const [loadingLegacyPreview, setLoadingLegacyPreview] = useState(linkPreview == null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const preview = linkPreview ?? legacyPreview;

  /**
   * Loads invitation preview details only for legacy links that omit display metadata.
   */
  useEffect(() => {
    if (linkPreview) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) {
          return;
        }
        setLoadingLegacyPreview(true);
        setError(null);
        return window.api.previewTeamHubInvitation(join.baseUrl, join.code);
      })
      .then((result) => {
        if (cancelled || result === undefined) {
          return;
        }
        setLegacyPreview(result);
        setConnectionName(result.user.name);
        setLoadingLegacyPreview(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setLoadingLegacyPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [join.baseUrl, join.code, linkPreview]);

  /**
   * Redeems the invitation, verifies the issued token, and saves the new connection.
   */
  const handleJoin = useCallback(async (): Promise<void> => {
    if (!preview || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setVerifiedSession(null);

    try {
      const redeemed = await window.api.redeemTeamHubInvitation(
        join.baseUrl,
        join.code,
        `${preview.user.name} onboarding`
      );
      setVerifiedSession(redeemed.session);
      const hub = {
        ...createBlankTeamHub(),
        name: connectionName.trim() || preview.user.name,
        baseUrl: join.baseUrl,
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
  }, [connectionName, dispatch, join.baseUrl, join.code, onClose, preview, saving]);

  const httpWarning =
    join.baseUrl.startsWith('http://') &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(join.baseUrl)
      ? 'This Team Hub uses HTTP. Your API token will be sent in cleartext over the network.'
      : null;

  const expired = preview?.expiresAt != null && Date.parse(preview.expiresAt) <= openedAt;

  const loadingPreview = linkPreview == null && loadingLegacyPreview;

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
            disabled={loadingPreview || saving || !preview || expired}
            onClick={() => void handleJoin()}
          >
            {saving ? 'Joining…' : 'Join Team Hub'}
          </Button>
        }
      >
        <FormGroup label="Team hub URL" htmlFor="team-hub-onboard-url">
          <Input
            id="team-hub-onboard-url"
            type="url"
            variant="surface"
            readOnly
            value={join.baseUrl}
          />
        </FormGroup>

        {loadingPreview ? (
          <p className="text-[14px] text-muted">Loading invitation details…</p>
        ) : preview ? (
          <>
            {join.hubName ? <p className="text-[14px] text-muted">Hub: {join.hubName}</p> : null}
            <div className="flex items-center gap-2 text-[14px]">
              <span className="font-medium">{preview.user.name}</span>
              <Badge variant="success">{preview.user.role}</Badge>
            </div>
            <p className={`text-[13px] ${expired ? 'text-danger' : 'text-muted'}`}>
              Invitation expires {new Date(preview.expiresAt).toLocaleString()}.
            </p>
            {join.accessSummary ? (
              <p className="text-[13px] text-muted">{join.accessSummary}</p>
            ) : null}
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

        {verifiedSession ? (
          <p className="text-[13px] text-muted">
            Verified as {verifiedSession.user.name} ({verifiedSession.user.role}).
          </p>
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
