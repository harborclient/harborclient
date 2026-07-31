import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerAlias } from '@harborclient/core/types';
import type { JSX } from 'react';

interface Props {
  /**
   * Zero-based index of this alias in the list (for ids/labels).
   */
  index: number;

  /**
   * Alias path and target values.
   */
  alias: LiveServerAlias;

  /**
   * When true, disables all controls.
   */
  disabled?: boolean;

  /**
   * Called when path or target changes.
   *
   * @param next - Updated alias.
   */
  onChange: (next: LiveServerAlias) => void;

  /**
   * Called when the user removes this alias row.
   */
  onRemove: () => void;
}

/**
 * One editable alias row (URL path → filesystem target) in the live server panel.
 */
export function AliasRow({ index, alias, disabled, onChange, onRemove }: Props): JSX.Element {
  const pathId = `live-server-alias-path-${index}`;
  const targetId = `live-server-alias-target-${index}`;

  return (
    <div className="flex items-end gap-2">
      <FormGroup label="URL path" htmlFor={pathId} className="min-w-0 flex-1" labelTone="muted">
        <Input
          id={pathId}
          value={alias.path}
          disabled={disabled}
          placeholder="/assets"
          onChange={(event) => onChange({ ...alias, path: event.target.value })}
        />
      </FormGroup>
      <FormGroup label="Directory" htmlFor={targetId} className="min-w-0 flex-1" labelTone="muted">
        <Input
          id={targetId}
          value={alias.target}
          disabled={disabled}
          placeholder="build/assets"
          onChange={(event) => onChange({ ...alias, target: event.target.value })}
        />
      </FormGroup>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        aria-label={`Remove alias ${index + 1}`}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}
