import { useId, type JSX } from 'react';
import { Button, Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerSslSettings } from '@harborclient/core/types';

interface Props {
  /**
   * Current TLS settings from the editor draft.
   */
  ssl: LiveServerSslSettings;

  /**
   * When true, all controls are disabled (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with a full replacement SSL settings object after any field change.
   *
   * @param next - Updated SSL settings.
   */
  onChange: (next: LiveServerSslSettings) => void;
}

/**
 * SSL tab: enable HTTPS and choose user-supplied certificate and private-key
 * PEM files. HarborClient does not generate certificates.
 *
 * Path fields stay visible but disabled when SSL is off so users can see
 * existing paths before enabling.
 *
 * @param props - SSL value, disabled flag, and change handler.
 */
export function SslSettings({ ssl, disabled, onChange }: Props): JSX.Element {
  const enabledId = useId();
  const certPathId = useId();
  const keyPathId = useId();
  const fieldsDisabled = disabled || !ssl.enabled;

  /**
   * Patches one SSL field and notifies the parent with a new object.
   *
   * @param patch - Partial SSL fields to merge onto the current value.
   */
  function update(patch: Partial<LiveServerSslSettings>): void {
    onChange({ ...ssl, ...patch });
  }

  /**
   * Opens the certificate-file picker and stores the selected path.
   */
  function handleBrowseCert(): void {
    void window.api.selectSslFile(ssl.certPath).then((selected) => {
      if (selected != null) {
        update({ certPath: selected });
      }
    });
  }

  /**
   * Opens the private-key file picker and stores the selected path.
   */
  function handleBrowseKey(): void {
    void window.api.selectSslFile(ssl.keyPath).then((selected) => {
      if (selected != null) {
        update({ keyPath: selected });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-muted">
        Supply your own PEM (or compatible) certificate and private key. HarborClient does not
        generate self-signed certificates.
      </p>

      <label htmlFor={enabledId} className="flex items-center gap-2">
        <Checkbox
          id={enabledId}
          checked={ssl.enabled}
          disabled={disabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
        <span>Enable SSL</span>
      </label>

      <FormGroup
        label="Certificate path"
        htmlFor={certPathId}
        description="Absolute path to the certificate file (.pem, .crt, .cert)."
      >
        <div className="flex gap-2">
          <Input
            id={certPathId}
            className="min-w-0 flex-1"
            value={ssl.certPath}
            disabled={fieldsDisabled}
            placeholder="/path/to/cert.pem"
            onChange={(event) => update({ certPath: event.target.value })}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={fieldsDisabled}
            onClick={handleBrowseCert}
          >
            Browse
          </Button>
        </div>
      </FormGroup>

      <FormGroup
        label="Private key path"
        htmlFor={keyPathId}
        description="Absolute path to the private key file (.pem, .key)."
      >
        <div className="flex gap-2">
          <Input
            id={keyPathId}
            className="min-w-0 flex-1"
            value={ssl.keyPath}
            disabled={fieldsDisabled}
            placeholder="/path/to/key.pem"
            onChange={(event) => update({ keyPath: event.target.value })}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={fieldsDisabled}
            onClick={handleBrowseKey}
          >
            Browse
          </Button>
        </div>
      </FormGroup>
    </div>
  );
}
