import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { TeamHub } from '#/shared/types';

interface Props {
  /**
   * Team hub draft being edited.
   */
  hub: TeamHub;

  /**
   * Whether the form is disabled during save.
   */
  disabled?: boolean;

  /**
   * Field-specific validation errors keyed by field name.
   */
  fieldErrors?: Record<string, string>;

  /**
   * Called when any field changes.
   */
  onChange: (hub: TeamHub) => void;
}

/**
 * Form fields for creating or editing a team hub connection.
 */
export function TeamHubForm({
  hub,
  disabled = false,
  fieldErrors = {},
  onChange
}: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
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
