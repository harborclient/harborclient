import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { TeamHub } from '@harborclient/core/types';
import { TeamHubFormAvatar, type TeamHubFormAvatarUser } from './TeamHubFormAvatar';

interface Props {
  /**
   * Team hub draft being edited.
   */
  hub: TeamHub;

  /**
   * Whether the form is for a new hub (avatar editing is disabled until saved).
   */
  isNew?: boolean;

  /**
   * Authenticated session user for the hub being edited, when available.
   */
  sessionUser?: TeamHubFormAvatarUser | null;

  /**
   * Pending cropped avatar image held locally until Save.
   */
  pendingAvatarDataUrl?: string | null;

  /**
   * Whether the form is disabled during save.
   */
  disabled?: boolean;

  /**
   * Field-specific validation errors keyed by field name.
   */
  fieldErrors?: Record<string, string>;

  /**
   * Called when any hub connection field changes.
   */
  onChange: (hub: TeamHub) => void;

  /**
   * Called when the pending cropped avatar draft changes.
   *
   * @param dataUrl - Cropped JPEG data URL, or null when cleared.
   */
  onPendingAvatarChange?: (dataUrl: string | null) => void;
}

/**
 * Form fields for creating or editing a team hub connection.
 */
export function TeamHubForm({
  hub,
  isNew = false,
  sessionUser = null,
  pendingAvatarDataUrl = null,
  disabled = false,
  fieldErrors = {},
  onChange,
  onPendingAvatarChange
}: Props): JSX.Element {
  const showAvatarEditor = !isNew && sessionUser != null && onPendingAvatarChange != null;

  return (
    <div className="flex flex-col gap-4">
      {showAvatarEditor ? (
        <TeamHubFormAvatar
          hubId={hub.id}
          user={sessionUser}
          pendingImageDataUrl={pendingAvatarDataUrl}
          disabled={disabled}
          onPendingImageChange={onPendingAvatarChange}
        />
      ) : null}

      <FormGroup label="Name" htmlFor="team-hub-name" error={fieldErrors.name}>
        <Input
          id="team-hub-name"
          type="text"
          variant="surface"
          value={hub.name}
          disabled={disabled}
          onChange={(event) => onChange({ ...hub, name: event.target.value })}
        />
      </FormGroup>

      <FormGroup label="Team hub URL" htmlFor="team-hub-base-url" error={fieldErrors.baseUrl}>
        <Input
          id="team-hub-base-url"
          type="url"
          variant="surface"
          value={hub.baseUrl}
          disabled={disabled}
          onChange={(event) => onChange({ ...hub, baseUrl: event.target.value })}
        />
      </FormGroup>

      <FormGroup label="API token" htmlFor="team-hub-token" error={fieldErrors.token}>
        <Input
          id="team-hub-token"
          type="password"
          autoComplete="off"
          variant="surface"
          value={hub.token}
          disabled={disabled}
          onChange={(event) => onChange({ ...hub, token: event.target.value })}
        />
      </FormGroup>
    </div>
  );
}
