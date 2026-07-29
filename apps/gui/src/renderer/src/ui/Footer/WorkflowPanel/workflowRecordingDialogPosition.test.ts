import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION,
  WORKFLOW_RECORDING_DIALOG_POSITION_KEY,
  loadWorkflowRecordingDialogPosition,
  saveWorkflowRecordingDialogPosition
} from './workflowRecordingDialogPosition';

/**
 * Minimal localStorage mock backed by an in-memory map.
 *
 * @returns Storage-compatible mock.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

describe('workflowRecordingDialogPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a saved position through localStorage', () => {
    saveWorkflowRecordingDialogPosition({ left: 240, top: 180 });
    expect(loadWorkflowRecordingDialogPosition()).toEqual({ left: 240, top: 180 });
  });

  it('returns null when nothing is stored', () => {
    expect(loadWorkflowRecordingDialogPosition()).toBeNull();
  });

  it('ignores garbage JSON and incomplete payloads', () => {
    localStorage.setItem(WORKFLOW_RECORDING_DIALOG_POSITION_KEY, '{not-json');
    expect(loadWorkflowRecordingDialogPosition()).toBeNull();

    localStorage.setItem(WORKFLOW_RECORDING_DIALOG_POSITION_KEY, JSON.stringify({ left: 1 }));
    expect(loadWorkflowRecordingDialogPosition()).toBeNull();

    localStorage.setItem(
      WORKFLOW_RECORDING_DIALOG_POSITION_KEY,
      JSON.stringify({ left: Number.NaN, top: 10 })
    );
    expect(loadWorkflowRecordingDialogPosition()).toBeNull();
  });

  it('exposes the default corner used when no saved position exists', () => {
    expect(DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION).toEqual({ left: 96, top: 96 });
  });
});
