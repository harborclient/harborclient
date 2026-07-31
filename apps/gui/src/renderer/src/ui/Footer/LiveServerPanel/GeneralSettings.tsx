import { useId, type JSX } from 'react';
import { Button, Checkbox, FaIcon, FormGroup, Input } from '@harborclient/sdk/components';
import { isLiveServerLoopbackHost } from '@harborclient/core/types';
import { faCircleExclamation } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Display name for the server.
   */
  name: string;

  /**
   * Absolute document-root directory.
   */
  root: string;

  /**
   * Port input as a string so the field can be blank (auto-select).
   */
  port: string;

  /**
   * When true, file watching reloads matching browser tabs on change.
   */
  watch: boolean;

  /**
   * Entry path opened when the Live Page starts (relative to the server origin).
   */
  openPath: string;

  /**
   * When true, restore the last navigated URL within this server’s origin.
   */
  rememberLastUrl: boolean;

  /**
   * Comma-separated directory index filenames.
   */
  indexFiles: string;

  /**
   * Bind host for the HTTP(S) listen address.
   */
  host: string;

  /**
   * When true, disables all controls (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called when the name field changes.
   *
   * @param value - Next name value.
   */
  onNameChange: (value: string) => void;

  /**
   * Called when the root directory field changes.
   *
   * @param value - Next root path.
   */
  onRootChange: (value: string) => void;

  /**
   * Opens the native directory picker for the root path.
   */
  onBrowse: () => void;

  /**
   * Called when the port field changes.
   *
   * @param value - Next port string.
   */
  onPortChange: (value: string) => void;

  /**
   * Called when the watch checkbox changes.
   *
   * @param value - Next watch flag.
   */
  onWatchChange: (value: boolean) => void;

  /**
   * Called when the open-path field changes.
   *
   * @param value - Next open path.
   */
  onOpenPathChange: (value: string) => void;

  /**
   * Called when the remember-last-URL checkbox changes.
   *
   * @param value - Next remember flag.
   */
  onRememberLastUrlChange: (value: boolean) => void;

  /**
   * Called when the index-files field changes.
   *
   * @param value - Next comma-separated index filenames.
   */
  onIndexFilesChange: (value: string) => void;

  /**
   * Called when the bind host field changes.
   *
   * @param value - Next host string.
   */
  onHostChange: (value: string) => void;
}

/**
 * General live server fields: name, host/port, root, open path, indexes, and watch.
 *
 * @param props - Field values, disabled flag, and change handlers.
 */
export function GeneralSettings({
  name,
  root,
  port,
  watch,
  openPath,
  rememberLastUrl,
  indexFiles,
  host,
  disabled,
  onNameChange,
  onRootChange,
  onBrowse,
  onPortChange,
  onWatchChange,
  onOpenPathChange,
  onRememberLastUrlChange,
  onIndexFilesChange,
  onHostChange
}: Props): JSX.Element {
  const nameId = useId();
  const rootId = useId();
  const portId = useId();
  const openPathId = useId();
  const rememberLastUrlId = useId();
  const indexFilesId = useId();
  const hostId = useId();
  const watchId = useId();
  const showLanWarning = !isLiveServerLoopbackHost(host);

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Name" htmlFor={nameId}>
        <Input
          id={nameId}
          autoFocus
          value={name}
          disabled={disabled}
          placeholder="My site"
          onChange={(event) => onNameChange(event.target.value)}
        />
      </FormGroup>

      <div className="flex gap-4">
        <FormGroup
          className="min-w-0 flex-1"
          label="Host"
          htmlFor={hostId}
          description="Bind address for the server. Use 127.0.0.1 for this machine only, or 0.0.0.0 to listen on the local network."
        >
          <Input
            id={hostId}
            value={host}
            disabled={disabled}
            placeholder="127.0.0.1"
            onChange={(event) => onHostChange(event.target.value)}
          />
        </FormGroup>

        <FormGroup
          className="min-w-0 flex-1"
          label="Port"
          htmlFor={portId}
          description="Leave blank to use the next free port from 5500."
        >
          <Input
            id={portId}
            inputMode="numeric"
            value={port}
            disabled={disabled}
            placeholder="Auto"
            onChange={(event) => onPortChange(event.target.value)}
          />
        </FormGroup>
      </div>

      {showLanWarning ? (
        <p className="m-0 flex items-start gap-2 text-[14px] text-danger" role="status">
          <FaIcon icon={faCircleExclamation} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Binding beyond loopback exposes this folder on the local network. Only use this on
            trusted networks.
          </span>
        </p>
      ) : null}

      <FormGroup label="Root directory" htmlFor={rootId}>
        <div className="flex gap-2">
          <Input
            id={rootId}
            className="min-w-0 flex-1"
            value={root}
            disabled={disabled}
            placeholder="/path/to/site"
            onChange={(event) => onRootChange(event.target.value)}
          />
          <Button type="button" variant="secondary" disabled={disabled} onClick={onBrowse}>
            Browse
          </Button>
        </div>
      </FormGroup>

      <FormGroup
        label="Open path"
        htmlFor={openPathId}
        description="Path or file opened in Live Page when the server starts (for example / or /docs/)."
      >
        <Input
          id={openPathId}
          value={openPath}
          disabled={disabled}
          placeholder="/"
          onChange={(event) => onOpenPathChange(event.target.value)}
        />
      </FormGroup>

      <FormGroup
        label="Index files"
        htmlFor={indexFilesId}
        description="Comma-separated filenames tried for directory URLs (for example index.html, index.htm)."
      >
        <Input
          id={indexFilesId}
          value={indexFiles}
          disabled={disabled}
          placeholder="index.html"
          onChange={(event) => onIndexFilesChange(event.target.value)}
        />
      </FormGroup>

      <label htmlFor={rememberLastUrlId} className="flex items-center gap-2">
        <Checkbox
          id={rememberLastUrlId}
          checked={rememberLastUrl}
          disabled={disabled}
          onChange={(event) => onRememberLastUrlChange(event.target.checked)}
        />
        <span>Remember last URL</span>
      </label>

      <label htmlFor={watchId} className="flex items-center gap-2">
        <Checkbox
          id={watchId}
          checked={watch}
          disabled={disabled}
          onChange={(event) => onWatchChange(event.target.checked)}
        />
        <span>Reload page when files change</span>
      </label>
    </div>
  );
}
