import { Button } from '@harborclient/sdk/components';
import type { LiveServerProxy } from '@harborclient/core/types';
import type { JSX } from 'react';
import { ProxyRow } from './ProxyRow';

interface Props {
  /**
   * Current reverse-proxy rules (order is significant; first match wins).
   */
  proxies: LiveServerProxy[];

  /**
   * When true, disables add/edit/remove/reorder.
   */
  disabled?: boolean;

  /**
   * Called when the proxies list changes.
   *
   * @param next - Updated proxies.
   */
  onChange: (next: LiveServerProxy[]) => void;
}

/**
 * Editable ordered list of reverse-proxy rules for a live server configuration.
 */
export function ProxyList({ proxies, disabled, onChange }: Props): JSX.Element {
  /**
   * Appends an empty enabled proxy row for the user to fill in.
   */
  function handleAdd(): void {
    onChange([...proxies, { path: '', target: '', stripPath: true, enabled: true }]);
  }

  /**
   * Swaps two proxy indexes and notifies the parent.
   *
   * @param fromIndex - Current index of the row to move.
   * @param toIndex - Destination index.
   */
  function moveProxy(fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex >= proxies.length) {
      return;
    }
    const updated = [...proxies];
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
      {proxies.length === 0 ? (
        <p className="text-muted m-0">
          Optional. Forward a path prefix to an HTTP(S) backend before static files are checked.
          Example: Path <code>/api</code>, Target <code>http://127.0.0.1:3000</code>.
        </p>
      ) : null}
      {proxies.map((proxy, index) => (
        <ProxyRow
          key={`proxy-${index}`}
          index={index}
          proxy={proxy}
          total={proxies.length}
          disabled={disabled}
          onChange={(next) => {
            const updated = [...proxies];
            updated[index] = next;
            onChange(updated);
          }}
          onMoveUp={() => {
            moveProxy(index, index - 1);
          }}
          onMoveDown={() => {
            moveProxy(index, index + 1);
          }}
          onRemove={() => {
            onChange(proxies.filter((_, i) => i !== index));
          }}
        />
      ))}
    </div>
  );
}
