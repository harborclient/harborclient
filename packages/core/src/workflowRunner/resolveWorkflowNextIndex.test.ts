import { describe, expect, it } from 'vitest';
import type { WorkflowAction } from '../types/workflow';
import { resolveWorkflowNextIndex } from './resolveWorkflowNextIndex';

/**
 * Builds a minimal workflow action fixture.
 *
 * @param uuid - Action UUID.
 * @returns Workflow action with a placeholder type and payload.
 */
function action(uuid: string): WorkflowAction {
  return { uuid, type: 'environment.activate', payload: {} };
}

describe('resolveWorkflowNextIndex', () => {
  const actions = [action('a'), action('b'), action('c')];

  it('advances sequentially when no directive is set', () => {
    expect(resolveWorkflowNextIndex(actions, 0, undefined)).toBe(1);
    expect(resolveWorkflowNextIndex(actions, 2, undefined)).toBeNull();
  });

  it('jumps to a matching action uuid', () => {
    expect(resolveWorkflowNextIndex(actions, 0, 'c')).toBe(2);
  });

  it('falls forward when the uuid is unknown', () => {
    expect(resolveWorkflowNextIndex(actions, 0, 'missing')).toBe(1);
    expect(resolveWorkflowNextIndex(actions, 2, 'missing')).toBeNull();
  });
});
