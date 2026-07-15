import { describe, expect, it, vi } from 'vitest';
import { setAlertModal, setConfirmModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  formatErrorMessage,
  formatIpcErrorMessage,
  openCollectionGitSettings,
  resolveConfirm,
  showAlert,
  showConfirm
} from './dialogHelpers';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

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
      payload: { title: 'Error', message: 'Failed to save', icon: undefined, action: undefined }
    });
  });

  it('showAlert dispatches warning icon state when requested', () => {
    const dispatch = vi.fn();
    showAlert(dispatch, 'Install failed.', 'Install failed', { icon: 'warning' });
    expect(dispatch).toHaveBeenCalledWith({
      type: setAlertModal.type,
      payload: {
        title: 'Install failed',
        message: 'Install failed.',
        icon: 'warning',
        action: undefined
      }
    });
  });

  it('showAlert dispatches optional action when provided', () => {
    const dispatch = vi.fn();
    showAlert(dispatch, 'Push failed', 'Push failed', {
      action: {
        kind: 'openCollectionGitSettings',
        label: 'Open Git settings',
        collectionId: 42
      }
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: setAlertModal.type,
      payload: {
        title: 'Push failed',
        message: 'Push failed',
        icon: undefined,
        action: {
          kind: 'openCollectionGitSettings',
          label: 'Open Git settings',
          collectionId: 42
        }
      }
    });
  });

  it('openCollectionGitSettings opens the collection page on the Git tab', () => {
    const dispatch = vi.fn();
    openCollectionGitSettings(dispatch, 7);
    expect(dispatch).toHaveBeenCalledWith({
      type: openPageTab.type,
      payload: { type: 'collection', id: 7, focusSection: 'git' }
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
        variant: 'danger',
        checkboxLabel: undefined,
        reconfirm: undefined
      }
    });

    resolveConfirm(dispatch, true);
    await expect(pending).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: setConfirmModal.type, payload: null });

    const cancelled = showConfirm(dispatch, { title: 'Delete', message: 'Again?' });
    resolveConfirm(dispatch, false);
    await expect(cancelled).resolves.toBe(false);
  });

  it('showConfirm with checkbox resolves ConfirmResult including checkbox state', async () => {
    const dispatch = vi.fn();
    const pending = showConfirm(dispatch, {
      title: 'Switch theme?',
      message: 'Switch appearance?',
      confirmLabel: 'Switch theme',
      checkboxLabel: 'Do not ask again'
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: setConfirmModal.type,
      payload: {
        title: 'Switch theme?',
        message: 'Switch appearance?',
        confirmLabel: 'Switch theme',
        cancelLabel: 'Cancel',
        variant: 'default',
        checkboxLabel: 'Do not ask again',
        reconfirm: undefined
      }
    });

    resolveConfirm(dispatch, true, true);
    await expect(pending).resolves.toEqual({ confirmed: true, checkboxChecked: true });

    const cancelled = showConfirm(dispatch, {
      title: 'Switch theme?',
      message: 'Again?',
      checkboxLabel: 'Do not ask again'
    });
    resolveConfirm(dispatch, false, true);
    await expect(cancelled).resolves.toEqual({ confirmed: false, checkboxChecked: true });
  });

  it('showConfirm passes reconfirm flag into confirm modal state', async () => {
    const dispatch = vi.fn();
    const pending = showConfirm(dispatch, {
      title: 'Delete collection',
      message: 'Delete this collection?',
      confirmLabel: 'Delete',
      variant: 'danger',
      reconfirm: true
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: setConfirmModal.type,
      payload: {
        title: 'Delete collection',
        message: 'Delete this collection?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger',
        checkboxLabel: undefined,
        reconfirm: true
      }
    });

    resolveConfirm(dispatch, true);
    await expect(pending).resolves.toBe(true);
  });
});
