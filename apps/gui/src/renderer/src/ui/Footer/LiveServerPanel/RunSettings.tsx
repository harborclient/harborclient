import { useEffect, useId, useState, type JSX } from 'react';
import {
  Checkbox,
  FormGroup,
  HelpTip,
  KeyValueEditor,
  Select,
  Switch,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import {
  RUNTIME_CATALOG,
  type KeyValue,
  type Runtime,
  type RuntimeRequirement,
  type Variable
} from '@harborclient/core/types';
import { setPendingRuntimeDraft } from '#/renderer/src/ui/Tabs/Settings/RuntimesSection/pendingRuntimeDraft';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

interface Props {
  /**
   * Global variables for Command / Arguments `{{token}}` highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Companion process command template. Empty means none.
   *
   * When a runtime is selected this holds arguments only; otherwise it holds
   * the full command. May include `{{variables}}` resolved at Start/restart.
   */
  runCommand: string;

  /**
   * Selected machine-local runtime id, or empty for None.
   */
  runtimeId: string;

  /**
   * When true, start the companion process with the live server.
   */
  runCommandEnabled: boolean;

  /**
   * Environment variables set when the companion process starts.
   */
  runCommandEnv: KeyValue[];

  /**
   * When true, restart the companion after an unexpected crash.
   */
  restartOnCrash: boolean;

  /**
   * Portable runtime requirement that could not be matched on this machine.
   */
  unresolvedRuntime?: RuntimeRequirement | null;

  /**
   * When true, disables all controls (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called when the enable switch changes.
   *
   * @param value - Next enable flag.
   */
  onRunCommandEnabledChange: (value: boolean) => void;

  /**
   * Called when the command / arguments field changes.
   *
   * @param value - Next command or arguments string.
   */
  onRunCommandChange: (value: string) => void;

  /**
   * Called when the runtime dropdown changes.
   *
   * @param value - Next runtime id, or empty for None.
   */
  onRuntimeIdChange: (value: string) => void;

  /**
   * Called when command environment rows change.
   *
   * @param value - Next env rows.
   */
  onRunCommandEnvChange: (value: KeyValue[]) => void;

  /**
   * Called when the restart-on-crash checkbox changes.
   *
   * @param value - Next restart flag.
   */
  onRestartOnCrashChange: (value: boolean) => void;
}

/**
 * Command tab: enable switch, companion process runtime, command/arguments,
 * environment variables, and crash-restart behavior for a live server.
 *
 * Detail fields stay visible but disabled when the command is off so users can
 * inspect a saved configuration before enabling it.
 *
 * @param props - Field values, disabled flag, and change handlers.
 */
export function RunSettings({
  variables,
  runCommand,
  runtimeId,
  runCommandEnabled,
  runCommandEnv,
  restartOnCrash,
  unresolvedRuntime = null,
  disabled,
  onRunCommandEnabledChange,
  onRunCommandChange,
  onRuntimeIdChange,
  onRunCommandEnvChange,
  onRestartOnCrashChange
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const enabledId = useId();
  const runtimeIdField = useId();
  const runCommandId = useId();
  const restartOnCrashId = useId();
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const hasRuntime = runtimeId.trim() !== '';
  const fieldsDisabled = disabled || !runCommandEnabled;
  const runCommandConfigured = runCommandEnabled && (hasRuntime || runCommand.trim() !== '');
  const commandLabel = hasRuntime ? 'Arguments' : 'Command';
  const commandPlaceholder = hasRuntime ? './server.js' : '/usr/bin/node ./server.js';

  /**
   * Loads machine-local runtimes for the Runtime dropdown.
   */
  useEffect(() => {
    let cancelled = false;
    void window.api.listRuntimes().then((list) => {
      if (!cancelled) {
        setRuntimes(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Opens Settings → Runtimes with the unresolved requirement prefilled.
   */
  function handleAddMissingRuntime(): void {
    if (unresolvedRuntime == null) {
      return;
    }
    setPendingRuntimeDraft({
      kind: unresolvedRuntime.kind,
      version: unresolvedRuntime.version,
      name: unresolvedRuntime.name
    });
    dispatch(openPageTab({ type: 'settings', section: 'runtimes' }));
  }

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={enabledId} className="inline-flex items-center gap-2">
        <Switch
          id={enabledId}
          checked={runCommandEnabled}
          disabled={disabled}
          onChange={(event) => onRunCommandEnabledChange(event.target.checked)}
        />
        <span>Enable command</span>
      </label>

      <div className="flex gap-4">
        <FormGroup
          className="min-w-0 w-1/4 shrink-0"
          label="Runtime"
          htmlFor={runtimeIdField}
          description={
            <span className="inline-flex items-center gap-1.5">
              <span>Executable</span>
              <HelpTip ariaLabel="Executable help">
                Settings → Runtimes. Choose None to run the command field directly.
              </HelpTip>
            </span>
          }
        >
          <Select
            id={runtimeIdField}
            value={runtimeId}
            disabled={fieldsDisabled}
            onChange={(event) => onRuntimeIdChange(event.target.value)}
          >
            <option value="">None</option>
            {runtimes.map((runtime) => (
              <option key={runtime.id} value={runtime.id}>
                {runtime.name || 'Untitled'}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup
          className="min-w-0 flex-1"
          label={commandLabel}
          htmlFor={runCommandId}
          description={
            <span className="inline-flex items-center gap-1.5">
              <span>
                {hasRuntime
                  ? 'Arguments passed to the selected runtime.'
                  : 'Optional absolute binary and arguments.'}
              </span>
              <HelpTip ariaLabel={`${commandLabel} help`}>
                {hasRuntime
                  ? 'Arguments passed to the selected runtime (for example ./server.js -p 3000). {{name}} tokens resolve from global variables at Start and on crash restart. cwd is the root directory.'
                  : 'Optional absolute binary and arguments (for example /usr/bin/node ./server.js). {{name}} tokens resolve from global variables at Start and on crash restart. cwd is the root directory. No shell — use Proxy rules to forward to the app.'}
              </HelpTip>
            </span>
          }
        >
          <VariableInput
            id={runCommandId}
            wrapperClassName={`${fieldFrame} w-full${fieldsDisabled ? ' pointer-events-none opacity-60' : ''}`}
            value={runCommand}
            variables={variables}
            placeholder={commandPlaceholder}
            className="app-no-drag"
            onChange={(value) => {
              if (!fieldsDisabled) {
                onRunCommandChange(value);
              }
            }}
          />
        </FormGroup>
      </div>

      {unresolvedRuntime != null ? (
        <p className="text-danger" role="status">
          This server needs a {RUNTIME_CATALOG[unresolvedRuntime.kind].label}{' '}
          {unresolvedRuntime.version} runtime
          {unresolvedRuntime.name ? ` (“${unresolvedRuntime.name}”)` : ''}.{' '}
          <button
            type="button"
            className="underline"
            disabled={fieldsDisabled}
            onClick={handleAddMissingRuntime}
          >
            Add it in Settings → Runtimes
          </button>
          .
        </p>
      ) : null}

      <FormGroup
        label="Environment variables"
        description="Set when the command starts. Values may include {{variables}}. These override matching keys from the selected runtime."
      >
        <div className={fieldsDisabled ? 'pointer-events-none opacity-60' : undefined}>
          <KeyValueEditor
            rows={runCommandEnv}
            onChange={(rows) => {
              if (!fieldsDisabled) {
                onRunCommandEnvChange(rows);
              }
            }}
            placeholderKey="NAME"
            placeholderValue="value"
            variables={variables}
          />
        </div>
      </FormGroup>

      <FormGroup
        className={runCommandConfigured ? undefined : 'opacity-60'}
        label="Restart on crash"
        htmlFor={restartOnCrashId}
        layout="checkbox"
        description="Restarts the command after an unexpected non-zero exit or signal. Does not restart on Stop or a clean exit."
      >
        <Checkbox
          id={restartOnCrashId}
          checked={restartOnCrash && runCommandConfigured}
          disabled={fieldsDisabled || !runCommandConfigured}
          onChange={(event) => onRestartOnCrashChange(event.target.checked)}
        />
      </FormGroup>
    </div>
  );
}
