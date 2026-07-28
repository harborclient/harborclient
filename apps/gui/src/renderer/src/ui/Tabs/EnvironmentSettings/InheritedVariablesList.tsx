import type { InheritedEnvironmentVariable } from '@harborclient/core/environmentTree';
import { Button } from '@harborclient/sdk/components';
import type { JSX } from 'react';

export interface Props {
  /**
   * Inherited variable rows from ancestor environments.
   */
  variables: InheritedEnvironmentVariable[];

  /**
   * Creates a local override row for the given inherited key.
   *
   * @param entry - Inherited variable to override on this environment.
   */
  onOverride: (entry: InheritedEnvironmentVariable) => void;
}

/**
 * Read-only list of variables inherited from parent environments with override actions.
 *
 * @param props - Inherited rows and override handler.
 * @returns Inherited variables section, or null when empty.
 */
export function InheritedVariablesList({ variables, onOverride }: Props): JSX.Element | null {
  if (variables.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-[15px] font-medium text-foreground">Inherited</h3>
      <p className="mb-3 text-[14px] text-muted">
        Variables from parent environments. Override to set a local value on this environment.
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {variables.map((entry) => (
          <li key={entry.key} className="flex items-center gap-3 px-3 py-2 text-[14px]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">{entry.key}</div>
              <div className="truncate text-muted">
                {entry.value || '(empty)'} · from {entry.sourceName}
              </div>
            </div>
            <Button
              type="button"
              variant="toolbar"
              onClick={() => onOverride(entry)}
              aria-label={`Override ${entry.key}`}
            >
              Override
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
