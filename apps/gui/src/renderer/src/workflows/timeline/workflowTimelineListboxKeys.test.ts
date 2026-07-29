import { describe, expect, it } from 'vitest';
import { resolveWorkflowTimelineListboxKey } from './workflowTimelineListboxKeys';

/**
 * Builds default params for listbox key resolution tests.
 *
 * @param overrides - Partial param overrides.
 * @returns Full resolve params.
 */
function params(
  overrides: Partial<Parameters<typeof resolveWorkflowTimelineListboxKey>[0]> = {}
): Parameters<typeof resolveWorkflowTimelineListboxKey>[0] {
  return {
    key: 'ArrowRight',
    shiftKey: false,
    selectedIndex: 2,
    actionCount: 5,
    playing: false,
    editable: true,
    ...overrides
  };
}

describe('resolveWorkflowTimelineListboxKey', () => {
  it('seeks left and right with clamping at the ends', () => {
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'ArrowLeft' }))).toEqual({
      type: 'seek',
      index: 1
    });
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'ArrowRight' }))).toEqual({
      type: 'seek',
      index: 3
    });
    expect(
      resolveWorkflowTimelineListboxKey(params({ key: 'ArrowLeft', selectedIndex: 0 }))
    ).toEqual({ type: 'seek', index: 0 });
    expect(
      resolveWorkflowTimelineListboxKey(params({ key: 'ArrowRight', selectedIndex: 4 }))
    ).toEqual({ type: 'seek', index: 4 });
  });

  it('seeks to first and last with Home and End', () => {
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'Home' }))).toEqual({
      type: 'seek',
      index: 0
    });
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'End' }))).toEqual({
      type: 'seek',
      index: 4
    });
  });

  it('re-seeks the current index on Enter and Space', () => {
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'Enter' }))).toEqual({
      type: 'seek',
      index: 2
    });
    expect(resolveWorkflowTimelineListboxKey(params({ key: ' ' }))).toEqual({
      type: 'seek',
      index: 2
    });
  });

  it('opens the menu on ContextMenu and Shift+F10 when editable', () => {
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'ContextMenu' }))).toEqual({
      type: 'openMenu'
    });
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'F10', shiftKey: true }))).toEqual({
      type: 'openMenu'
    });
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'F10' }))).toBeNull();
    expect(
      resolveWorkflowTimelineListboxKey(params({ key: 'ContextMenu', editable: false }))
    ).toBeNull();
  });

  it('returns null while playing or when there are no actions', () => {
    expect(resolveWorkflowTimelineListboxKey(params({ playing: true }))).toBeNull();
    expect(resolveWorkflowTimelineListboxKey(params({ actionCount: 0 }))).toBeNull();
    expect(resolveWorkflowTimelineListboxKey(params({ key: 'a' }))).toBeNull();
  });
});
