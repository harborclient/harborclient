import { describe, expect, it, vi } from 'vitest';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { createTab, type RequestTab } from '#/renderer/src/store/tabs';
import { restoreTabsState } from '#/renderer/src/store/slices/tabsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  captureWorkflowRecordCheckpoint,
  restoreWorkflowRecordCheckpoint
} from './workflowRecordCheckpoints';

/**
 * Builds a minimal root state for checkpoint capture tests.
 *
 * @param overrides - Partial root fields to merge.
 * @returns Root state stub.
 */
function sampleState(
  overrides: {
    tabs?: RootState['tabs'];
    activeEnvironmentId?: number | null;
  } = {}
): RootState {
  const tab = createTab();
  return {
    tabs: overrides.tabs ?? { tabs: [tab], activeTabId: tab.tabId },
    environments: {
      environments: [],
      activeEnvironmentId: overrides.activeEnvironmentId ?? 7
    }
  } as unknown as RootState;
}

describe('workflowRecordCheckpoints', () => {
  it('captures a deep clone of tabs and environment selection', () => {
    const tab: RequestTab = { ...createTab(), tabId: 'tab-1' };
    tab.draft.name = 'Original';
    const state = sampleState({
      tabs: { tabs: [tab], activeTabId: 'tab-1' },
      activeEnvironmentId: 3
    });

    const checkpoint = captureWorkflowRecordCheckpoint(state, 1_250);
    expect(checkpoint.activeTabId).toBe('tab-1');
    expect(checkpoint.activeEnvironmentId).toBe(3);
    expect(checkpoint.elapsedMs).toBe(1_250);
    const captured = checkpoint.tabs[0] as RequestTab;
    expect(captured.draft.name).toBe('Original');

    tab.draft.name = 'Mutated';
    expect(captured.draft.name).toBe('Original');
  });

  it('restores tabs and active environment via dispatch', () => {
    const tab = { ...createTab(), tabId: 'tab-restored' };
    const checkpoint = captureWorkflowRecordCheckpoint(
      sampleState({
        tabs: { tabs: [tab], activeTabId: 'tab-restored' },
        activeEnvironmentId: 9
      }),
      500
    );

    const dispatch = vi.fn();
    restoreWorkflowRecordCheckpoint(checkpoint, dispatch as unknown as AppDispatch);

    expect(dispatch).toHaveBeenCalledWith(
      restoreTabsState({
        tabs: checkpoint.tabs,
        activeTabId: 'tab-restored'
      })
    );
    expect(dispatch).toHaveBeenCalledWith(setActiveEnvironmentId(9));
  });
});
