import { Button } from '@harborclient/sdk/components';
import type { LiveServerAlias } from '@harborclient/core/types';
import type { JSX } from 'react';
import { AliasRow } from './AliasRow';

interface Props {
  /**
   * Current aliases.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, disables add/edit/remove.
   */
  disabled?: boolean;

  /**
   * Called when the aliases list changes.
   *
   * @param next - Updated aliases.
   */
  onChange: (next: LiveServerAlias[]) => void;
}

/**
 * Editable list of path aliases for a live server configuration.
 */
export function AliasList({ aliases, disabled, onChange }: Props): JSX.Element {
  /**
   * Appends an empty alias row.
   */
  function handleAdd(): void {
    onChange([...aliases, { path: '', target: '' }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={disabled} onClick={handleAdd}>
          Add alias
        </Button>
      </div>
      {aliases.length === 0 ? (
        <p className="text-muted m-0">No aliases yet. Add one to map a URL path to a folder.</p>
      ) : null}
      {aliases.map((alias, index) => (
        <AliasRow
          key={`alias-${index}`}
          index={index}
          alias={alias}
          disabled={disabled}
          onChange={(next) => {
            const updated = [...aliases];
            updated[index] = next;
            onChange(updated);
          }}
          onRemove={() => {
            onChange(aliases.filter((_, i) => i !== index));
          }}
        />
      ))}
    </div>
  );
}
