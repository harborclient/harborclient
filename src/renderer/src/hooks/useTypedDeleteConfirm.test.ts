import { describe, expect, it, vi } from 'vitest';

import {
  canCloseTypedDeleteConfirm,
  runTypedDeleteConfirm
} from '#/renderer/src/hooks/useTypedDeleteConfirm.logic';
import { isDeleteConfirmationReady } from '#/renderer/src/ui/shared/deleteConfirmModal.logic';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn()
  }
}));

describe('canCloseTypedDeleteConfirm', () => {
  it('returns false while a delete request is in flight', () => {
    expect(canCloseTypedDeleteConfirm(true)).toBe(false);
  });

  it('returns true when not busy', () => {
    expect(canCloseTypedDeleteConfirm(false)).toBe(true);
  });
});

describe('runTypedDeleteConfirm', () => {
  it('returns cancelled when no target is selected', async () => {
    const onDelete = vi.fn();

    await expect(
      runTypedDeleteConfirm({
        target: null,
        onDelete
      })
    ).resolves.toEqual({ status: 'cancelled' });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete and onSuccess on success', async () => {
    const onDelete = vi.fn(async () => undefined);
    const onSuccess = vi.fn();
    const toast = (await import('react-hot-toast')).default;

    await expect(
      runTypedDeleteConfirm({
        target: { id: 'snippet-1' },
        onDelete,
        onSuccess,
        successMessage: 'Snippet deleted.'
      })
    ).resolves.toEqual({ status: 'success' });

    expect(onDelete).toHaveBeenCalledWith({ id: 'snippet-1' });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Snippet deleted.');
  });

  it('captures error messages from rejected delete handlers', async () => {
    const onDelete = vi.fn(async () => {
      throw new Error('Delete failed');
    });

    await expect(
      runTypedDeleteConfirm({
        target: { id: 'snippet-1' },
        onDelete
      })
    ).resolves.toEqual({ status: 'error', message: 'Delete failed' });
  });

  it('stringifies non-Error rejections', async () => {
    const onDelete = vi.fn(async () => {
      throw 'network down';
    });

    await expect(
      runTypedDeleteConfirm({
        target: { id: 'snippet-1' },
        onDelete
      })
    ).resolves.toEqual({ status: 'error', message: 'network down' });
  });
});

describe('isDeleteConfirmationReady', () => {
  it('returns false while busy', () => {
    expect(isDeleteConfirmationReady(true, 'DELETE', 'DELETE')).toBe(false);
  });

  it('returns false when the confirmation text does not match', () => {
    expect(isDeleteConfirmationReady(false, 'delete', 'DELETE')).toBe(false);
  });

  it('returns true when idle and the confirmation text matches', () => {
    expect(isDeleteConfirmationReady(false, 'DELETE', 'DELETE')).toBe(true);
  });
});
