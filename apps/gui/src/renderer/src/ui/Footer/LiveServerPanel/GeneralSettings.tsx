import { useId, type JSX } from 'react';
import { Button, Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerAlias } from '@harborclient/core/types';
import { AliasList } from './AliasList';

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
   * Path aliases mounted before the document root.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, file watching reloads matching browser tabs on change.
   */
  watch: boolean;

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
   * Called when the aliases list changes.
   *
   * @param next - Updated aliases.
   */
  onAliasesChange: (next: LiveServerAlias[]) => void;

  /**
   * Called when the watch checkbox changes.
   *
   * @param value - Next watch flag.
   */
  onWatchChange: (value: boolean) => void;
}

/**
 * General live server fields: name, root, port, aliases, and file watching.
 *
 * @param props - Field values, disabled flag, and change handlers.
 */
export function GeneralSettings({
  name,
  root,
  port,
  aliases,
  watch,
  disabled,
  onNameChange,
  onRootChange,
  onBrowse,
  onPortChange,
  onAliasesChange,
  onWatchChange
}: Props): JSX.Element {
  const nameId = useId();
  const rootId = useId();
  const portId = useId();
  const watchId = useId();

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

      <AliasList aliases={aliases} disabled={disabled} onChange={onAliasesChange} />

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
