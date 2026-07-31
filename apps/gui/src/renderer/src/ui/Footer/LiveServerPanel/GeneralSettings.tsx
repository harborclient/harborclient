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
   * Global variable name set to the server origin URL on start.
   */
  urlVariable: string;

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
   * Companion process command (absolute binary + args). Empty means none.
   */
  runCommand: string;

  /**
   * When true, restart the companion after an unexpected crash.
   */
  restartOnCrash: boolean;

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
   * Called when the URL variable field changes.
   *
   * @param value - Next global variable name.
   */
  onUrlVariableChange: (value: string) => void;

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

  /**
   * Called when the run-command field changes.
   *
   * @param value - Next command string.
   */
  onRunCommandChange: (value: string) => void;

  /**
   * Called when the restart-on-crash checkbox changes.
   *
   * @param value - Next restart flag.
   */
  onRestartOnCrashChange: (value: boolean) => void;
}

/**
 * General live server fields: name, URL variable, host/port, root, run command,
 * open path, indexes, and watch.
 *
 * @param props - Field values, disabled flag, and change handlers.
 */
export function GeneralSettings({
  name,
  urlVariable,
  root,
  port,
  watch,
  openPath,
  rememberLastUrl,
  indexFiles,
  host,
  runCommand,
  restartOnCrash,
  disabled,
  onNameChange,
  onUrlVariableChange,
  onRootChange,
  onBrowse,
  onPortChange,
  onWatchChange,
  onOpenPathChange,
  onRememberLastUrlChange,
  onIndexFilesChange,
  onHostChange,
  onRunCommandChange,
  onRestartOnCrashChange
}: Props): JSX.Element {
  const nameId = useId();
  const urlVariableId = useId();
  const rootId = useId();
  const portId = useId();
  const openPathId = useId();
  const rememberLastUrlId = useId();
  const indexFilesId = useId();
  const hostId = useId();
  const runCommandId = useId();
  const restartOnCrashId = useId();
  const watchId = useId();
  const showLanWarning = !isLiveServerLoopbackHost(host);
  const runCommandConfigured = runCommand.trim() !== '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <FormGroup
          className="min-w-0 flex-1"
          label="Name"
          description="An internal name for the Live Server."
          htmlFor={nameId}
        >
          <Input
            id={nameId}
            autoFocus
            value={name}
            disabled={disabled}
            placeholder="My site"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </FormGroup>

        <FormGroup
          className="min-w-0 flex-1"
          label="Variable"
          htmlFor={urlVariableId}
          description="Global variable set to this server's full URL when it starts."
        >
          <Input
            id={urlVariableId}
            value={urlVariable}
            disabled={disabled}
            placeholder="server_url"
            onChange={(event) => onUrlVariableChange(event.target.value)}
          />
        </FormGroup>
      </div>

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
        label="Run command"
        htmlFor={runCommandId}
        description="Optional absolute binary and arguments started with the live server (for example /usr/bin/node ./server.js). cwd is the root directory. No shell — use Proxy rules to forward to the app."
      >
        <Input
          id={runCommandId}
          value={runCommand}
          disabled={disabled}
          placeholder="/usr/bin/node ./server.js"
          onChange={(event) => onRunCommandChange(event.target.value)}
        />
      </FormGroup>

      <label
        htmlFor={restartOnCrashId}
        className={`flex items-center gap-2 ${runCommandConfigured ? '' : 'opacity-60'}`}
      >
        <Checkbox
          id={restartOnCrashId}
          checked={restartOnCrash && runCommandConfigured}
          disabled={disabled || !runCommandConfigured}
          onChange={(event) => onRestartOnCrashChange(event.target.checked)}
        />
        <span>Restart on crash</span>
      </label>
      <p className="m-0 -mt-2 text-[14px] text-muted">
        Restarts the run command after an unexpected non-zero exit or signal. Does not restart on
        Stop or a clean exit.
      </p>

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
