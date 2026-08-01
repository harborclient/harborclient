import { useEffect, useId, type JSX } from 'react';
import {
  Button,
  Checkbox,
  FaIcon,
  FieldError,
  FormGroup,
  Input,
  Select,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import { isLiveServerLoopbackHost, type Variable } from '@harborclient/core/types';
import { faCircleExclamation } from '#/renderer/src/fontawesome';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';

interface Props {
  /**
   * Display name for the server.
   */
  name: string;

  /**
   * Selected storage provider connection id.
   */
  connectionId: string;

  /**
   * Global variables for Run command `{{token}}` highlighting and tooltips.
   */
  variables: Variable[];

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
   * When true, open a Live Page at the start path when the server starts.
   */
  openPathOnStartup: boolean;

  /**
   * When true, restore the last navigated path within this server’s origin.
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
   * Companion process command template (absolute binary + args). Empty means
   * none. May include `{{variables}}` resolved from globals at Start/restart.
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
   * Called when the storage provider changes.
   *
   * @param value - Destination storage connection id.
   */
  onConnectionIdChange: (value: string) => void;

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
   * Called when the start-path field changes.
   *
   * @param value - Next start path.
   */
  onOpenPathChange: (value: string) => void;

  /**
   * Called when the open-path-on-startup checkbox changes.
   *
   * @param value - Next open-on-startup flag.
   */
  onOpenPathOnStartupChange: (value: boolean) => void;

  /**
   * Called when the remember-last-path checkbox changes.
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
 * General live server fields: name, URL variable, host/port, root, indexes,
 * run command, start path, and watch.
 *
 * @param props - Field values, disabled flag, and change handlers.
 */
export function GeneralSettings({
  name,
  connectionId,
  variables,
  urlVariable,
  root,
  port,
  watch,
  openPath,
  openPathOnStartup,
  rememberLastUrl,
  indexFiles,
  host,
  runCommand,
  restartOnCrash,
  disabled,
  onNameChange,
  onConnectionIdChange,
  onUrlVariableChange,
  onRootChange,
  onBrowse,
  onPortChange,
  onWatchChange,
  onOpenPathChange,
  onOpenPathOnStartupChange,
  onRememberLastUrlChange,
  onIndexFilesChange,
  onHostChange,
  onRunCommandChange,
  onRestartOnCrashChange
}: Props): JSX.Element {
  const nameId = useId();
  const providerSelectId = useId();
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders(connectionId ? [connectionId] : [], {
    excludeAdminTeamHubs: true,
    excludeLiveServerUnsupportedTeamHubs: true,
    excludeGit: true,
    retainConnectionId: connectionId
  });
  const urlVariableId = useId();
  const rootId = useId();
  const portId = useId();
  const openPathId = useId();
  const openPathOnStartupId = useId();
  const rememberLastUrlId = useId();
  const indexFilesId = useId();
  const hostId = useId();
  const runCommandId = useId();
  const restartOnCrashId = useId();
  const watchId = useId();
  const showLanWarning = !isLiveServerLoopbackHost(host);
  const runCommandConfigured = runCommand.trim() !== '';
  const pathControlsDisabled = disabled || !openPathOnStartup;

  /**
   * Defaults new live-server drafts to the active provider after providers load.
   */
  useEffect(() => {
    if (!connectionId && primaryProviderId) {
      onConnectionIdChange(primaryProviderId);
    }
  }, [connectionId, onConnectionIdChange, primaryProviderId]);

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

      <FormGroup label="Storage location" htmlFor={providerSelectId}>
        <Select
          id={providerSelectId}
          value={connectionId}
          disabled={disabled || providersLoading || providers.length === 0}
          onChange={(event) => onConnectionIdChange(event.target.value)}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name || 'Untitled'} ({providerOptionLabel(provider)})
            </option>
          ))}
        </Select>
        {providersError ? <FieldError spacing="field">{providersError}</FieldError> : null}
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

      <label htmlFor={watchId} className="flex items-center gap-2">
        <Checkbox
          id={watchId}
          checked={watch}
          disabled={disabled}
          onChange={(event) => onWatchChange(event.target.checked)}
        />
        <span>Reload page when files change</span>
      </label>

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

      <div className="flex gap-4">
        <FormGroup
          className="min-w-0 flex-1"
          label="Run command"
          htmlFor={runCommandId}
          description="Optional absolute binary and arguments started with the live server (for example /usr/bin/node ./server.js or {{node_bin}} ./server.js). {{name}} tokens resolve from global variables at Start and on crash restart. cwd is the root directory. No shell — use Proxy rules to forward to the app."
        >
          <VariableInput
            id={runCommandId}
            wrapperClassName={`${fieldFrame} w-full${disabled ? ' pointer-events-none opacity-60' : ''}`}
            value={runCommand}
            variables={variables}
            placeholder="/usr/bin/node ./server.js"
            className="app-no-drag"
            onChange={(value) => {
              if (!disabled) {
                onRunCommandChange(value);
              }
            }}
          />
        </FormGroup>

        <FormGroup
          className={`min-w-0 flex-1 ${runCommandConfigured ? '' : 'opacity-60'}`}
          label="Restart on crash"
          htmlFor={restartOnCrashId}
          layout="checkbox"
          description="Restarts the run command after an unexpected non-zero exit or signal. Does not restart on Stop or a clean exit."
        >
          <Checkbox
            id={restartOnCrashId}
            checked={restartOnCrash && runCommandConfigured}
            disabled={disabled || !runCommandConfigured}
            onChange={(event) => onRestartOnCrashChange(event.target.checked)}
          />
        </FormGroup>
      </div>

      <label htmlFor={openPathOnStartupId} className="flex items-center gap-2">
        <Checkbox
          id={openPathOnStartupId}
          checked={openPathOnStartup}
          disabled={disabled}
          onChange={(event) => onOpenPathOnStartupChange(event.target.checked)}
        />
        <span>Open path on startup</span>
      </label>

      <label
        htmlFor={rememberLastUrlId}
        className={`flex items-center gap-2${pathControlsDisabled ? ' opacity-60' : ''}`}
      >
        <Checkbox
          id={rememberLastUrlId}
          checked={rememberLastUrl && openPathOnStartup}
          disabled={pathControlsDisabled}
          onChange={(event) => onRememberLastUrlChange(event.target.checked)}
        />
        <span>Remember last path</span>
      </label>

      <FormGroup
        className={pathControlsDisabled ? 'opacity-60' : undefined}
        label="Start path"
        htmlFor={openPathId}
        description="Path or file opened in Live Page when the server starts (for example / or /docs/)."
      >
        <Input
          id={openPathId}
          value={openPath}
          disabled={pathControlsDisabled}
          placeholder="/"
          onChange={(event) => onOpenPathChange(event.target.value)}
        />
      </FormGroup>
    </div>
  );
}
