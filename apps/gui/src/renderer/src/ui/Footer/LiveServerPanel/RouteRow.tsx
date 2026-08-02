import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import type { LiveServerRoute } from '@harborclient/core/types';
import type { JSX } from 'react';

interface Props {
  /**
   * Zero-based index of this route in the list (for ids/labels).
   */
  index: number;

  /**
   * Route match, target, and enabled values.
   */
  route: LiveServerRoute;

  /**
   * Total number of routes (controls Move up/down disabled state).
   */
  total: number;

  /**
   * When true, disables all controls.
   */
  disabled?: boolean;

  /**
   * Called when match, target, or enabled changes.
   *
   * @param next - Updated route.
   */
  onChange: (next: LiveServerRoute) => void;

  /**
   * Moves this route one position earlier in the list.
   */
  onMoveUp: () => void;

  /**
   * Moves this route one position later in the list.
   */
  onMoveDown: () => void;

  /**
   * Called when the user removes this route row.
   */
  onRemove: () => void;
}

/**
 * One editable routing rule row (match → file/directory target) in the Routing tab.
 */
export function RouteRow({
  index,
  route,
  total,
  disabled,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove
}: Props): JSX.Element {
  const matchId = `live-server-route-match-${index}`;
  const targetId = `live-server-route-target-${index}`;
  const enabledId = `live-server-route-enabled-${index}`;
  const ruleLabel = `Rule ${index + 1}`;

  return (
    <div className="flex flex-col gap-2 rounded border border-separator p-3">
      <div className="flex flex-wrap items-end gap-2">
        <FormGroup
          bordered={false}
          label="Match"
          htmlFor={matchId}
          className="min-w-0 flex-1"
          labelTone="muted"
        >
          <Input
            id={matchId}
            value={route.match}
            disabled={disabled}
            placeholder="* or ^/docs/"
            aria-label={`${ruleLabel} match`}
            onChange={(event) => onChange({ ...route, match: event.target.value })}
          />
        </FormGroup>
        <FormGroup
          bordered={false}
          label="Target"
          htmlFor={targetId}
          className="min-w-0 flex-1"
          labelTone="muted"
        >
          <Input
            id={targetId}
            value={route.target}
            disabled={disabled}
            placeholder="index.html"
            aria-label={`${ruleLabel} target`}
            onChange={(event) => onChange({ ...route, target: event.target.value })}
          />
        </FormGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={enabledId} className="flex items-center gap-2">
          <input
            id={enabledId}
            type="checkbox"
            checked={route.enabled !== false}
            disabled={disabled}
            onChange={(event) => onChange({ ...route, enabled: event.target.checked })}
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
