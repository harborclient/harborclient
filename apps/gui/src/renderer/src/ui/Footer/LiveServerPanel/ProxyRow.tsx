import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerProxy } from '@harborclient/core/types';
import type { JSX } from 'react';

interface Props {
  /**
   * Zero-based index of this proxy in the list (for ids/labels).
   */
  index: number;

  /**
   * Proxy path, target, stripPath, and enabled values.
   */
  proxy: LiveServerProxy;

  /**
   * Total number of proxies (controls Move up/down disabled state).
   */
  total: number;

  /**
   * When true, disables all controls.
   */
  disabled?: boolean;

  /**
   * Called when any field on this row changes.
   *
   * @param next - Updated proxy rule.
   */
  onChange: (next: LiveServerProxy) => void;

  /**
   * Moves this proxy one position earlier in the list.
   */
  onMoveUp: () => void;

  /**
   * Moves this proxy one position later in the list.
   */
  onMoveDown: () => void;

  /**
   * Called when the user removes this proxy row.
   */
  onRemove: () => void;
}

/**
 * One editable reverse-proxy rule row (path prefix → upstream URL) in the Proxy tab.
 */
export function ProxyRow({
  index,
  proxy,
  total,
  disabled,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove
}: Props): JSX.Element {
  const pathId = `live-server-proxy-path-${index}`;
  const targetId = `live-server-proxy-target-${index}`;
  const stripPathId = `live-server-proxy-strip-${index}`;
  const enabledId = `live-server-proxy-enabled-${index}`;
  const ruleLabel = `Proxy ${index + 1}`;

  return (
    <div className="flex flex-col gap-2 rounded border border-separator p-3">
      <div className="flex flex-wrap items-end gap-2">
        <FormGroup label="Path" htmlFor={pathId} className="min-w-0 flex-1" labelTone="muted">
          <Input
            id={pathId}
            value={proxy.path}
            disabled={disabled}
            placeholder="/api"
            aria-label={`${ruleLabel} path`}
            onChange={(event) => onChange({ ...proxy, path: event.target.value })}
          />
        </FormGroup>
        <FormGroup
          label="Target URL"
          htmlFor={targetId}
          className="min-w-0 flex-[2]"
          labelTone="muted"
        >
          <Input
            id={targetId}
            value={proxy.target}
            disabled={disabled}
            placeholder="http://127.0.0.1:3000"
            aria-label={`${ruleLabel} target URL`}
            onChange={(event) => onChange({ ...proxy, target: event.target.value })}
          />
        </FormGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={stripPathId} className="flex items-center gap-2">
          <input
            id={stripPathId}
            type="checkbox"
            checked={proxy.stripPath !== false}
            disabled={disabled}
            onChange={(event) => onChange({ ...proxy, stripPath: event.target.checked })}
          />
          <span>Strip path</span>
        </label>
        <label htmlFor={enabledId} className="flex items-center gap-2">
          <input
            id={enabledId}
            type="checkbox"
            checked={proxy.enabled !== false}
            disabled={disabled}
            onChange={(event) => onChange({ ...proxy, enabled: event.target.checked })}
          />
          <span>Enabled</span>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || index === 0}
            aria-label={`Move ${ruleLabel} up`}
            onClick={onMoveUp}
          >
            Move up
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || index >= total - 1}
            aria-label={`Move ${ruleLabel} down`}
            onClick={onMoveDown}
          >
            Move down
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            aria-label={`Remove ${ruleLabel}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
