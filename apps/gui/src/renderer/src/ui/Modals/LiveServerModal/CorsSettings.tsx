import { useId, type JSX } from 'react';
import { Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerCorsSettings } from '@harborclient/core/types';

interface Props {
  /**
   * Current CORS settings from the modal state.
   */
  cors: LiveServerCorsSettings;

  /**
   * When true, all controls are disabled (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with a full replacement CORS settings object after any field change.
   */
  onChange: (next: LiveServerCorsSettings) => void;
}

/**
 * Form group for enabling CORS and editing the base Express `cors` options.
 *
 * Detail fields stay visible but disabled when CORS is off so users can see
 * the defaults before enabling.
 *
 * @param props - CORS value, disabled flag, and change handler.
 */
export function CorsSettings({ cors, disabled, onChange }: Props): JSX.Element {
  const enabledId = useId();
  const originId = useId();
  const methodsId = useId();
  const allowedHeadersId = useId();
  const credentialsId = useId();
  const fieldsDisabled = disabled || !cors.enabled;

  /**
   * Patches one CORS field and notifies the parent with a new object.
   *
   * @param patch - Partial CORS fields to merge onto the current value.
   */
  function update(patch: Partial<LiveServerCorsSettings>): void {
    onChange({ ...cors, ...patch });
  }

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-text">CORS</legend>

      <label htmlFor={enabledId} className="flex items-center gap-2">
        <Checkbox
          id={enabledId}
          checked={cors.enabled}
          disabled={disabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        <span>Enable CORS</span>
      </label>

      <FormGroup
        label="Origin"
        htmlFor={originId}
        description="Use * for any origin, or a comma-separated list."
      >
        <Input
          id={originId}
          value={cors.origin}
          disabled={fieldsDisabled}
          placeholder="*"
          onChange={(event) => update({ origin: event.target.value })}
        />
      </FormGroup>

      <FormGroup
        label="Methods"
        htmlFor={methodsId}
        description="Comma-separated HTTP methods, or *."
      >
        <Input
          id={methodsId}
          value={cors.methods}
          disabled={fieldsDisabled}
          placeholder="GET,HEAD,PUT,PATCH,POST,DELETE"
          onChange={(event) => update({ methods: event.target.value })}
        />
      </FormGroup>

      <FormGroup
        label="Allowed headers"
        htmlFor={allowedHeadersId}
        description="Use * or leave blank to reflect requested headers."
      >
        <Input
          id={allowedHeadersId}
          value={cors.allowedHeaders}
          disabled={fieldsDisabled}
          placeholder="*"
          onChange={(event) => update({ allowedHeaders: event.target.value })}
        />
      </FormGroup>

      <label htmlFor={credentialsId} className="flex items-center gap-2">
        <Checkbox
          id={credentialsId}
          checked={cors.credentials}
          disabled={fieldsDisabled}
          onChange={(event) => update({ credentials: event.target.checked })}
        />
        <span>Allow credentials</span>
      </label>
    </fieldset>
  );
}
