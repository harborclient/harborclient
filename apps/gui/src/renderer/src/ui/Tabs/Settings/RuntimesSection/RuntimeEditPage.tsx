import {
  BackButton,
  Button,
  FieldError,
  FormGroup,
  Input,
  KeyValueEditor,
  Page,
  Select
} from '@harborclient/sdk/components';
import {
  RUNTIME_CATALOG,
  RUNTIME_KINDS,
  type Runtime,
  type RuntimeKind,
  type Variable,
  type VerifyRuntimeResult
} from '@harborclient/core/types';
import { useId, useState, type JSX } from 'react';
import { useEscapeBackCapture } from '#/renderer/src/hooks/useEscapeBack';

interface Props {
  /**
   * Runtime draft being edited.
   */
  runtime: Runtime;

  /**
   * Whether this is a new runtime.
   */
  isNew: boolean;

  /**
   * Whether save is in progress.
   */
  saving: boolean;

  /**
   * Inline error message from save or validation.
   */
  error: string | null;

  /**
   * Global variables for env-value `{{token}}` highlighting.
   */
  variables: Variable[];

  /**
   * Called when the draft changes.
   *
   * @param runtime - Next draft value.
   */
  onChange: (runtime: Runtime) => void;

  /**
   * Returns to the runtimes list without saving.
   */
  onCancel: () => void;

  /**
   * Persists the draft.
   */
  onSave: () => void;
}

/**
 * Settings sub-page for adding or editing a machine-local companion-process runtime.
 */
export function RuntimeEditPage({
  runtime,
  isNew,
  saving,
  error,
  variables,
  onChange,
  onCancel,
  onSave
}: Props): JSX.Element {
  const nameId = useId();
  const kindId = useId();
  const versionId = useId();
  const pathId = useId();
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyRuntimeResult | null>(null);

  const catalog = RUNTIME_CATALOG[runtime.kind];
  const versions = catalog.versions.includes(runtime.version)
    ? catalog.versions
    : [runtime.version, ...catalog.versions];
  const busy = saving || verifying;

  /**
   * Returns to the runtimes list on Escape when Verify/Save are not in progress.
   */
  useEscapeBackCapture(onCancel, !busy);

  /**
   * Updates one field on the draft runtime.
   *
   * @param patch - Partial fields to merge.
   */
  function patch(patch: Partial<Runtime>): void {
    setVerifyResult(null);
    onChange({ ...runtime, ...patch });
  }

  /**
   * Updates the kind and resets version to the first catalog entry for that kind.
   *
   * @param kind - Next runtime kind.
   */
  function handleKindChange(kind: RuntimeKind): void {
    const nextVersions = RUNTIME_CATALOG[kind].versions;
    const version = nextVersions.includes(runtime.version)
      ? runtime.version
      : (nextVersions[0] ?? '');
    patch({
      kind,
      version,
      name:
        runtime.name.trim() === '' || runtime.name.startsWith(RUNTIME_CATALOG[runtime.kind].label)
          ? `${RUNTIME_CATALOG[kind].label} v${version}`
          : runtime.name
    });
  }

  /**
   * Opens a file picker for the executable path.
   */
  async function handleBrowseFile(): Promise<void> {
    const selected = await window.api.selectFile(runtime.path);
    if (selected != null) {
      patch({ path: selected });
    }
  }

  /**
   * Opens a directory picker for a bin folder.
   */
  async function handleBrowseFolder(): Promise<void> {
    const selected = await window.api.selectDirectory(runtime.path);
    if (selected != null) {
      patch({ path: selected });
    }
  }

  /**
   * Runs the version command against the configured path.
   */
  async function handleVerify(): Promise<void> {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await window.api.verifyRuntime({
        kind: runtime.kind,
        version: runtime.version,
        path: runtime.path
      });
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({
        ok: false,
        resolvedPath: runtime.path,
        detectedVersion: '',
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={isNew ? 'Add runtime' : 'Edit runtime'}
      description="Choose a supported runtime kind and version, then point HarborClient at the executable or its bin directory."
      actions={<BackButton disabled={busy} onClick={onCancel} />}
      footer={
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            disabled={busy || runtime.path.trim() === ''}
            onClick={() => void handleVerify()}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      {error ? <FieldError spacing="section">{error}</FieldError> : null}

      <div className="flex flex-col gap-4">
        <FormGroup
          label="Name"
          htmlFor={nameId}
          description="Display name in the Runtime dropdown."
        >
          <Input
            id={nameId}
            value={runtime.name}
            disabled={saving}
            placeholder={`${catalog.label} v${runtime.version}`}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </FormGroup>

        <div className="flex gap-4">
          <FormGroup className="min-w-0 flex-1" label="Kind" htmlFor={kindId}>
            <Select
              id={kindId}
              value={runtime.kind}
              disabled={saving}
              onChange={(event) => handleKindChange(event.target.value as RuntimeKind)}
            >
              {RUNTIME_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {RUNTIME_CATALOG[kind].label}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup
            className="min-w-0 flex-1"
            label="Version"
            htmlFor={versionId}
            description="Major.minor only (patch is ignored)."
          >
            <Select
              id={versionId}
              value={runtime.version}
              disabled={saving}
              onChange={(event) => patch({ version: event.target.value })}
            >
              {versions.map((version) => (
                <option key={version} value={version}>
                  v{version}
                </option>
              ))}
            </Select>
          </FormGroup>
        </div>

        <FormGroup
          label="Path"
          htmlFor={pathId}
          description="Absolute path to the executable file, or to a bin directory containing it."
        >
          <div className="flex gap-2">
            <Input
              id={pathId}
              className="min-w-0 flex-1"
              value={runtime.path}
              disabled={saving}
              placeholder={`/usr/bin/${catalog.binary}`}
              onChange={(event) => patch({ path: event.target.value })}
            />
            <Button type="button" disabled={saving} onClick={() => void handleBrowseFile()}>
              Browse file
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleBrowseFolder()}>
              Browse folder
            </Button>
          </div>
          {verifyResult != null ? (
            <p className={verifyResult.ok ? 'mt-2 text-success' : 'mt-2 text-danger'} role="status">
              {verifyResult.ok
                ? `Verified ${verifyResult.resolvedPath} (v${verifyResult.detectedVersion})`
                : verifyResult.error}
            </p>
          ) : null}
        </FormGroup>

        <FormGroup
          label="Environment variables"
          description="Set when this runtime is used. Values may include {{variables}}. Live server env vars override these."
        >
          <KeyValueEditor
            rows={runtime.env}
            onChange={(env) => patch({ env })}
            placeholderKey="NAME"
            placeholderValue="value"
            variables={variables}
          />
        </FormGroup>
      </div>
    </Page>
  );
}
