import { describe, expect, it, vi } from 'vitest';
import { setAlertModal, setConfirmModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  formatErrorMessage,
  formatIpcErrorMessage,
  resolveConfirm,
  showAlert,
  showConfirm
} from '#/renderer/src/ui/modals/dialogHelpers';

describe('dialogHelpers', () => {
  it('formatErrorMessage returns Error.message or fallback', () => {
    expect(formatErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(formatErrorMessage('nope', 'fallback')).toBe('fallback');
  });

  it('formatIpcErrorMessage strips Electron IPC wrapper prefixes', () => {
    expect(
      formatIpcErrorMessage(
        new Error(
          "Error invoking remote method 'plugins:installFromGit': Error: Plugin signature could not be verified."
        ),
        'fallback'
      )
    ).toBe('Plugin signature could not be verified.');
    expect(formatIpcErrorMessage(new Error('Plain failure'), 'fallback')).toBe('Plain failure');
    expect(formatIpcErrorMessage('nope', 'fallback')).toBe('fallback');
  });

  it('showAlert dispatches alert modal state', () => {
    const dispatch = vi.fn();
    showAlert(dispatch, 'Failed to save', 'Error');
    expect(dispatch).toHaveBeenCalledWith({
      type: setAlertModal.type,
      payload: { title: 'Error', message: 'Failed to save', icon: undefined }
    });
  });

  it('showAlert dispatches warning icon state when requested', () => {
    const dispatch = vi.fn();
    showAlert(dispatch, 'Install failed.', 'Install failed', { icon: 'warning' });
    expect(dispatch).toHaveBeenCalledWith({
      type: setAlertModal.type,
      payload: { title: 'Install failed', message: 'Install failed.', icon: 'warning' }
    });
  });

  it('showConfirm resolves true when confirmed and false when cancelled', async () => {
    const dispatch = vi.fn();
    const pending = showConfirm(dispatch, {
      title: 'Delete',
      message: 'Delete this item?',
      confirmLabel: 'Delete',
      variant: 'danger'
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: setConfirmModal.type,
      payload: {
        title: 'Delete',
        message: 'Delete this item?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger'
      }
    });

    resolveConfirm(dispatch, true);
    await expect(pending).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: setConfirmModal.type, payload: null });

    const cancelled = showConfirm(dispatch, { title: 'Delete', message: 'Again?' });
    resolveConfirm(dispatch, false);
    await expect(cancelled).resolves.toBe(false);
  });
});
