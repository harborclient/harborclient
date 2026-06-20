import { useState, type JSX } from 'react';
import type { Environment } from '#/shared/types';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { sourceRow } from '#/renderer/src/ui/classes';

interface Props {
  /**
   * All saved environments.
   */
  environments: Environment[];

  /**
   * ID of the active environment, or null when none is selected.
   */
  activeEnvironmentId: number | null;

  /**
   * Called when the user selects an environment.
   */
  onSelectEnvironment: (id: number) => void;

  /**
   * Opens the environment settings view.
   */
  onConfigureEnvironment: (id: number) => void;

  /**
   * Deletes an environment.
   */
  onDeleteEnvironment: (id: number) => Promise<void>;
}

/**
 * Environment list with active-row highlight and row actions.
 */
export function Environments({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onConfigureEnvironment,
  onDeleteEnvironment
}: Props): JSX.Element {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-0.5">
      {environments.length === 0 && (
        <div className="px-2 py-1.5 text-[13px] text-muted">No environments yet</div>
      )}
      {environments.map((environment) => {
        const selected = activeEnvironmentId === environment.id;

        return (
          <div key={environment.id} className={sourceRow(selected)}>
            <button
              className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[13px] text-inherit app-no-drag"
              onClick={() => onSelectEnvironment(environment.id)}
              onDoubleClick={() => onConfigureEnvironment(environment.id)}
            >
              {environment.name}
            </button>
            <RowActionsMenu
              menuId={`environment-${environment.id}`}
              openMenuId={openMenuId}
              onOpenChange={setOpenMenuId}
              items={[
                { label: 'Settings', onSelect: () => onConfigureEnvironment(environment.id) },
                {
                  label: 'Delete',
                  variant: 'danger',
                  onSelect: () => {
                    if (confirm(`Delete environment "${environment.name}"?`)) {
                      void onDeleteEnvironment(environment.id);
                    }
                  }
                }
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}
