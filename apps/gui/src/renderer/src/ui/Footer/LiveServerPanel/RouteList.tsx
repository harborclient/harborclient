import { Button } from '@harborclient/sdk/components';
import type { LiveServerRoute } from '@harborclient/core/types';
import type { JSX } from 'react';
import { RouteRow } from './RouteRow';

interface Props {
  /**
   * Current routing rules (order is significant; first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * When true, disables add/edit/remove/reorder.
   */
  disabled?: boolean;

  /**
   * Called when the routes list changes.
   *
   * @param next - Updated routes.
   */
  onChange: (next: LiveServerRoute[]) => void;
}

/**
 * Editable ordered list of path routing rules for a live server configuration.
 */
export function RouteList({ routes, disabled, onChange }: Props): JSX.Element {
  /**
   * Appends an empty enabled route row for the user to fill in.
   */
  function handleAdd(): void {
    onChange([...routes, { match: '', target: '', enabled: true }]);
  }

  /**
   * Swaps two route indexes and notifies the parent.
   *
   * @param fromIndex - Current index of the row to move.
   * @param toIndex - Destination index.
   */
  function moveRoute(fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex >= routes.length) {
      return;
    }
    const updated = [...routes];
    const [row] = updated.splice(fromIndex, 1);
    if (row == null) {
      return;
    }
    updated.splice(toIndex, 0, row);
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">Rules</span>
        <Button type="button" variant="secondary" disabled={disabled} onClick={handleAdd}>
          Add rule
        </Button>
      </div>
      {routes.length === 0 ? (
        <p className="text-muted m-0">
          Optional. After static files miss, match a path with <code>*</code> or a regex and serve a
          file or directory. Example SPA fallback: Match <code>*</code>, Target{' '}
          <code>index.html</code>.
        </p>
      ) : null}
      {routes.map((route, index) => (
        <RouteRow
          key={`route-${index}`}
          index={index}
          route={route}
          total={routes.length}
          disabled={disabled}
          onChange={(next) => {
            const updated = [...routes];
            updated[index] = next;
            onChange(updated);
          }}
          onMoveUp={() => {
            moveRoute(index, index - 1);
          }}
          onMoveDown={() => {
            moveRoute(index, index + 1);
          }}
          onRemove={() => {
            onChange(routes.filter((_, i) => i !== index));
          }}
        />
      ))}
    </div>
  );
}
