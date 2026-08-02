import { Badge, Button, ResourceListPrimary, ResourceListRow } from '@harborclient/sdk/components';
import type { Runtime } from '@harborclient/core/types';
import { RUNTIME_CATALOG } from '@harborclient/core/types';
import type { JSX } from 'react';

interface Props {
  /**
   * Runtime row to display.
   */
  runtime: Runtime;

  /**
   * Exports this runtime as a JSON file.
   */
  onExport: () => void;

  /**
   * Opens the edit modal for this runtime.
   */
  onEdit: () => void;

  /**
   * Removes this runtime after confirmation.
   */
  onRemove: () => void;
}

/**
 * One runtime row in Settings → Runtimes.
 */
export function RuntimeRow({ runtime, onExport, onEdit, onRemove }: Props): JSX.Element {
  const kindLabel = RUNTIME_CATALOG[runtime.kind].label;

  return (
    <ResourceListRow
      primary={
        <div className="flex min-w-0 flex-col gap-1">
          <ResourceListPrimary>{runtime.name || 'Untitled'}</ResourceListPrimary>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              {kindLabel} v{runtime.version}
            </Badge>
            <span className="min-w-0 truncate text-muted" title={runtime.path}>
              {runtime.path || 'No path set'}
            </span>
          </div>
        </div>
      }
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onExport}>
            Export
          </Button>
          <Button type="button" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" variant="secondary" onClick={onRemove}>
            Remove
          </Button>
        </>
      }
    />
  );
}
