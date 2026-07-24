import { Button, FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunResults } from '#/renderer/src/store/slices/runResultsSlice';
import { clearRunResults } from '#/renderer/src/store/thunks/runResults';
import { faEraser, faFilter } from '#/renderer/src/fontawesome';
import { useSidebarSectionFilter } from '../filter/sidebarSectionFilterContext';

const RUNS_FILTER_MENU_ID = 'runs-collection-filter';

/**
 * Header actions for the Runs sidebar section (clear + collection filter).
 */
export function RunsHeaderActions(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const runResults = useAppSelector(selectRunResults);
  const { runsCollectionFilter, setRunsCollectionFilter } = useSidebarSectionFilter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isEmpty = runResults.length === 0;

  /**
   * Distinct collection names present in the current Runs list, sorted for the menu.
   */
  const collectionNames = useMemo(() => {
    const names = new Set<string>();
    for (const runResult of runResults) {
      if (runResult.collectionName) {
        names.add(runResult.collectionName);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [runResults]);

  /**
   * Clears all saved run results after confirmation.
   */
  const handleClearRuns = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Clear runs',
      message: 'Clear all saved runs?',
      confirmLabel: 'Clear',
      variant: 'danger'
    });
    if (confirmed) {
      void dispatch(clearRunResults());
    }
  }, [confirm, dispatch]);

  /**
   * Filter menu groups with a checkmark on the active collection (or All).
   */
  const filterMenuGroups = useMemo(
    () => [
      [
        {
          label: 'All collections',
          checked: runsCollectionFilter == null,
          onSelect: () => setRunsCollectionFilter(null)
        },
        ...collectionNames.map((name) => ({
          label: name,
          checked: runsCollectionFilter === name,
          onSelect: () => setRunsCollectionFilter(runsCollectionFilter === name ? null : name)
        }))
      ]
    ],
    [collectionNames, runsCollectionFilter, setRunsCollectionFilter]
  );

  const filterActive = runsCollectionFilter != null;

  return (
    <>
      <Button
        variant="toolbar"
        className="text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Clear all runs"
        disabled={isEmpty}
        onClick={() => {
          void handleClearRuns();
        }}
      >
        <FaIcon icon={faEraser} className="h-3.5 w-3.5" />
      </Button>
      {collectionNames.length > 0 ? (
        <RowActionsMenu
          menuId={RUNS_FILTER_MENU_ID}
          openMenuId={openMenuId}
          onOpenChange={setOpenMenuId}
          triggerVariant="toolbar"
          triggerIcon={faFilter}
          triggerAriaLabel="Filter runs by collection"
          triggerTitle="Filter by collection"
          triggerClassName={
            filterActive ? 'text-text hover:text-text' : 'text-muted hover:text-text'
          }
          groups={filterMenuGroups}
        />
      ) : null}
    </>
  );
}
