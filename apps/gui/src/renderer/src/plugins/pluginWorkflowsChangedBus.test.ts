import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginWorkflowsChangedSubscribers,
  emitPluginWorkflowsChanged,
  subscribePluginWorkflowsChanged
} from './pluginWorkflowsChangedBus';

const pushPluginWorkflowsChangedMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  pushPluginWorkflowsChangedMock.mockClear();
  clearPluginWorkflowsChangedSubscribers();
  vi.stubGlobal('window', {
    api: {
      pushPluginWorkflowsChanged: pushPluginWorkflowsChangedMock
    }
  });
});

afterEach(() => {
  clearPluginWorkflowsChangedSubscribers();
  vi.unstubAllGlobals();
});

describe('pluginWorkflowsChangedBus', () => {
  it('notifies subscribers and forwards events to plugin webviews through IPC', () => {
    const listener = vi.fn();
    subscribePluginWorkflowsChanged(listener);

    emitPluginWorkflowsChanged({ reason: 'updated', workflowId: 7 });

    expect(listener).toHaveBeenCalledWith({ reason: 'updated', workflowId: 7 });
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({
      reason: 'updated',
      workflowId: 7
    });
  });

  it('stops notifying after dispose', () => {
    const listener = vi.fn();
    const disposable = subscribePluginWorkflowsChanged(listener);

    disposable.dispose();
    emitPluginWorkflowsChanged({ reason: 'created' });

    expect(listener).not.toHaveBeenCalled();
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({ reason: 'created' });
  });
});
