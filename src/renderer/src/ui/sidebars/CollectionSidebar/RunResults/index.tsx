import { useState, type JSX } from 'react';
import type { SavedRunResultSummary } from '#/shared/collectionRunner';
import { RowActionsMenu } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { SortableRow } from '#/renderer/src/ui/sidebars/CollectionSidebar/Collections/SortableRow';
import { sourceRow } from '#/renderer/src/ui/shared/classes';
import { runResultDragId, runResultSummaryText, runResultStatusDotClass } from './utils';

interface Props {
  /**
   * Saved run result rows in sidebar display order.
   */
  runResults: SavedRunResultSummary[];

  /**
   * Maps connection ids to display names for the storage location badge.
   */
  connectionNamesById: Record<string, string>;

  /**
   * Whether the storage location badge should be rendered, toggled from the
   * sidebar toolbar alongside the Collections storage location badges.
   */
  showStorageLocationBadges: boolean;

  /**
   * Opens a saved run result in the read-only collection runner tab.
   *
   * @param id - Global run result id from storage routing.
   */
  onSelectRunResult: (id: number) => void;

  /**
   * Deletes a saved run result snapshot.
   *
   * @param id - Global run result id from storage routing.
   */
  onDeleteRunResult: (id: number) => Promise<void>;
}

/**
 * Run results list with row actions and no drag reordering.
 */
export function RunResults({
  runResults,
  connectionNamesById,
  showStorageLocationBadges,
  onSelectRunResult,
  onDeleteRunResult
}: Props): JSX.Element {
  const confirm = useConfirm();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="sidebar-source-list flex flex-col gap-0">
      {runResults.length === 0 ? (
        <div className="px-2 py-1.5 text-[16px] text-muted">No saved run results yet</div>
      ) : null}

      {runResults.map((runResult) => {
        const menuId = `run-result-${runResult.id}`;
        const connectionName = connectionNamesById[runResult.connectionId] ?? null;

        return (
          <SortableRow
            key={runResult.id}
            id={runResultDragId(runResult.id)}
            className={sourceRow(false, true)}
            dragHandleLabel={`Run result "${runResult.label}"`}
            disabled
            compact
            onRowContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpenMenuId(menuId);
            }}
          >
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer border-none bg-transparent py-0 text-left text-inherit app-no-drag"
              data-sidebar-run-result-id={runResult.id}
              aria-label={`Open run result ${runResult.label}, ${runResultSummaryText(runResult.summary)}`}
              onClick={() => onSelectRunResult(runResult.id)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${runResultStatusDotClass(runResult.summary)}`}
                  aria-hidden="true"
                />
                <span className="truncate text-[16px] text-text">{runResult.label}</span>
                {showStorageLocationBadges && connectionName != null && (
                  <span
                    className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[11px] font-medium text-info"
                    title={`Stored in ${connectionName}`}
                  >
                    {connectionName}
                  </span>
                )}
              </span>
            </button>
            <RowActionsMenu
              menuId={menuId}
              openMenuId={openMenuId}
              onOpenChange={setOpenMenuId}
              groups={[
                [
                  {
                    label: 'Delete',
                    variant: 'danger',
                    onSelect: () => {
                      void (async () => {
                        const confirmed = await confirm({
                          title: 'Delete run result',
                          message: `Delete saved run result "${runResult.label}"?`,
                          confirmLabel: 'Delete',
                          variant: 'danger'
                        });
                        if (confirmed) {
                          void onDeleteRunResult(runResult.id);
                        }
                      })();
                    }
                  }
                ]
              ]}
            />
          </SortableRow>
        );
      })}
    </div>
  );
}
