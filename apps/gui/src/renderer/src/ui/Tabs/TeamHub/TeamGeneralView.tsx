import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub, TeamHubAvatar } from '@harborclient/core/types';
import { Button, FieldError, FormGroup, Input, Page } from '@harborclient/sdk/components';
import { faGear } from '#/renderer/src/fontawesome';
import { useTeamHubServiceScan } from '#/renderer/src/hooks/useTeamHubServiceScan';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { primeTeamHubServerAvatarImage } from '#/renderer/src/ui/Shared/TeamHubAvatarImage/teamHubAvatarImageCache';
import { validateTeamHubForm } from './constants';
import { TeamHubServerAvatar } from './TeamHubServerAvatar';

interface Props {
  /**
   * Admin team hub connection whose general settings are being managed.
   */
  hub: TeamHub;
}

/**
 * Returns whether the connection draft differs from the persisted hub settings.
 *
 * @param draft - Editable local connection fields.
 * @param hub - Persisted team hub connection.
 */
function isConnectionDirty(draft: TeamHub, hub: TeamHub): boolean {
  return draft.name !== hub.name || draft.baseUrl !== hub.baseUrl || draft.token !== hub.token;
}

/**
 * Team Hub admin General page with server info, connection settings, and hub avatar.
 */
export function TeamGeneralView({ hub }: Props): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Stable single-hub list so the session scan effect does not re-run every render.
   */
  const hubs = useMemo(() => [hub], [hub]);
  const { sessionUserByHubId, hubAvatarByHubId, scanning, rescanServices } = useTeamHubServiceScan(
    hubs,
    0,
    true
  );
  const sessionUser = sessionUserByHubId.get(hub.id) ?? null;
  const hubAvatar: TeamHubAvatar | null = hubAvatarByHubId.get(hub.id) ?? null;

  const [draft, setDraft] = useState<TeamHub>(hub);
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirty = isConnectionDirty(draft, hub) || pendingAvatarDataUrl != null;

  /**
   * Persists dirty connection fields and any pending hub avatar image.
   */
  const handleSave = async (): Promise<void> => {
    if (!isDirty || saving) {
      return;
    }

    const connectionDirty = isConnectionDirty(draft, hub);
    if (connectionDirty) {
      const validationErrors = validateTeamHubForm(draft);
      if (validationErrors) {
        setFieldErrors(validationErrors);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      if (connectionDirty) {
        await window.api.saveTeamHub(draft);
        await dispatch(refreshCollections());
        void dispatch(refreshHubLlmModels());
      }

      if (pendingAvatarDataUrl != null) {
        const updatedAvatar = await window.api.updateTeamHubAvatar(hub.id, {
          imageDataUrl: pendingAvatarDataUrl
        });
        if (updatedAvatar.imageUrl != null) {
          primeTeamHubServerAvatarImage(hub.id, updatedAvatar.imageUrl, pendingAvatarDataUrl);
        }
        setPendingAvatarDataUrl(null);
      }

      rescanServices();
      toast.success('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const serverName = hubAvatar?.name || hub.name || 'Untitled';
  const roleLabel = sessionUser?.role ?? (scanning ? 'Loading…' : 'Unknown');

  return (
    <Page
      embedded
      title="General"
      icon={faGear}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
      actions={
        <Button
          type="button"
          className="whitespace-nowrap"
          disabled={!isDirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="flex flex-col gap-8">
        {error ? <FieldError spacing="modal">{error}</FieldError> : null}

        <section aria-labelledby="team-hub-general-avatar-heading">
          <h3 id="team-hub-general-avatar-heading" className="mb-3 font-semibold">
            Team Hub avatar
          </h3>
          <p className="mb-4 text-muted">
            Upload a square image used for this Team Hub in HarborClient. Initials are shown when no
            image is set.
          </p>
          <TeamHubServerAvatar
            hubId={hub.id}
            hubName={hub.name}
            hubAvatar={hubAvatar}
            pendingImageDataUrl={pendingAvatarDataUrl}
            disabled={saving}
            onPendingImageChange={setPendingAvatarDataUrl}
          />
        </section>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          <section
            aria-labelledby="team-hub-general-server-heading"
            className="h-full rounded-md border border-separator p-4"
          >
            <h3 id="team-hub-general-server-heading" className="mb-3 font-semibold">
              Server
            </h3>
            <dl className="grid gap-3">
              <div>
                <dt className="text-muted">Name</dt>
                <dd>{serverName}</dd>
              </div>
              <div>
                <dt className="text-muted">URL</dt>
                <dd className="break-all">{hub.baseUrl}</dd>
              </div>
              <div>
                <dt className="text-muted">Your role</dt>
                <dd>{roleLabel}</dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="team-hub-general-connection-heading"
            className="h-full rounded-md border border-separator p-4"
          >
            <h3 id="team-hub-general-connection-heading" className="mb-3 font-semibold">
              Connection
            </h3>
            <p className="mb-4 text-muted">
              Local connection settings stored in HarborClient. Changing the URL or token updates
              how this app reaches the hub; it does not rename the server itself.
            </p>

            <div className="flex flex-col gap-4">
              <FormGroup label="Name" htmlFor="team-hub-general-name" error={fieldErrors.name}>
                <Input
                  id="team-hub-general-name"
                  type="text"
                  variant="surface"
                  value={draft.name}
                  disabled={saving}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </FormGroup>

              <FormGroup
                label="Team hub URL"
                htmlFor="team-hub-general-base-url"
                error={fieldErrors.baseUrl}
              >
                <Input
                  id="team-hub-general-base-url"
                  type="url"
                  variant="surface"
                  value={draft.baseUrl}
                  disabled={saving}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                />
              </FormGroup>

              <FormGroup
                label="API token"
                htmlFor="team-hub-general-token"
                error={fieldErrors.token}
              >
                <Input
                  id="team-hub-general-token"
                  type="password"
                  autoComplete="off"
                  variant="surface"
                  value={draft.token}
                  disabled={saving}
                  onChange={(event) => setDraft({ ...draft, token: event.target.value })}
                />
              </FormGroup>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
