import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import modalsReducer, {
  closeAboutModal,
  closeCollectionModal,
  closeInviteModal,
  closeSyncModal,
  finishSync,
  incrementSyncCompleted,
  openAboutModal,
  openCollectionModal,
  openInviteModal,
  openSyncModal,
  setAboutVersion,
  setCollectionModalInviteTokenInput,
  setCollectionModalName,
  setCollectionModalTab,
  setCollectionModalSubmitError,
  setInviteRecipientKid,
  setPendingLoadRequest,
  setQuitPrompt,
  setAlertModal,
  setConfirmModal,
  setSyncProviderStatus,
  setSyncProviders
} from '#/renderer/src/store/slices/modalsSlice';

describe('modalsSlice', () => {
  it('starts with all modals closed', () => {
    const state = modalsReducer(undefined, { type: 'unknown' });
    expect(state.collectionModal).toBeNull();
    expect(state.invite).toBeNull();
    expect(state.pendingLoadRequest).toBeNull();
    expect(state.quitPrompt).toBeNull();
    expect(state.about).toEqual({ open: false, version: '' });
    expect(state.syncModal).toEqual({
      open: false,
      running: false,
      providers: [],
      completed: 0,
      total: 0
    });
    expect(state.alertModal).toBeNull();
    expect(state.confirmModal).toBeNull();
  });

  it('opens and closes the collection modal', () => {
    let state = modalsReducer(
      undefined,
      openCollectionModal({ mode: 'create-and-save', tab: 'invite' })
    );
    expect(state.collectionModal).toEqual({
      mode: 'create-and-save',
      tab: 'invite',
      name: '',
      providerId: '',
      inviteTokenInput: '',
      submitError: null
    });

    state = modalsReducer(state, setCollectionModalName('My API'));
    expect(state.collectionModal?.name).toBe('My API');

    state = modalsReducer(state, setCollectionModalTab('import'));
    expect(state.collectionModal?.tab).toBe('import');
    expect(state.collectionModal?.submitError).toBeNull();

    state = modalsReducer(state, setCollectionModalSubmitError('Create failed'));
    expect(state.collectionModal?.submitError).toBe('Create failed');

    state = modalsReducer(state, setCollectionModalInviteTokenInput('token'));
    expect(state.collectionModal?.inviteTokenInput).toBe('token');
    expect(state.collectionModal?.submitError).toBeNull();

    state = modalsReducer(state, closeCollectionModal());
    expect(state.collectionModal).toBeNull();
  });

  it('opens invite modal and clears token when recipient changes', () => {
    let state = modalsReducer(
      undefined,
      openInviteModal({ collectionId: 1, collectionName: 'Demo' })
    );
    expect(state.invite?.collectionId).toBe(1);
    expect(state.invite?.trustedKeysLoading).toBe(true);

    state = modalsReducer(state, setInviteRecipientKid('kid-1'));
    expect(state.invite?.recipientKid).toBe('kid-1');

    state = modalsReducer(state, closeInviteModal());
    expect(state.invite).toBeNull();
  });

  it('tracks pending load and quit prompts', () => {
    const request = {
      id: 1,
      collection_id: 2,
      folder_id: null,
      name: 'Get users',
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      body_type: 'none' as const,
      pre_request_script: '',
      post_request_script: '',
      comment: '',
      auth: defaultAuth(),
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };

    let state = modalsReducer(
      undefined,
      setPendingLoadRequest({ req: request, reason: 'settings' })
    );
    expect(state.pendingLoadRequest).toEqual({ req: request, reason: 'settings' });

    state = modalsReducer(state, setQuitPrompt(['Draft A', 'Draft B']));
    expect(state.quitPrompt).toEqual(['Draft A', 'Draft B']);
  });

  it('opens about modal and stores version', () => {
    let state = modalsReducer(undefined, openAboutModal());
    expect(state.about.open).toBe(true);

    state = modalsReducer(state, setAboutVersion('1.2.3'));
    expect(state.about.version).toBe('1.2.3');

    state = modalsReducer(state, closeAboutModal());
    expect(state.about).toEqual({ open: false, version: '' });
  });

  it('opens and closes alert and confirm modals', () => {
    let state = modalsReducer(
      undefined,
      setAlertModal({ title: 'Error', message: 'Something went wrong' })
    );
    expect(state.alertModal).toEqual({ title: 'Error', message: 'Something went wrong' });

    state = modalsReducer(state, setAlertModal(null));
    expect(state.alertModal).toBeNull();

    state = modalsReducer(
      state,
      setConfirmModal({
        title: 'Delete item',
        message: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger'
      })
    );
    expect(state.confirmModal?.variant).toBe('danger');

    state = modalsReducer(state, setConfirmModal(null));
    expect(state.confirmModal).toBeNull();
  });

  it('tracks sync modal progress and summary state', () => {
    let state = modalsReducer(undefined, openSyncModal());
    expect(state.syncModal).toEqual({
      open: true,
      running: true,
      providers: [],
      completed: 0,
      total: 0
    });

    state = modalsReducer(
      state,
      setSyncProviders([
        {
          id: 'db-1',
          name: 'Local SQLite',
          kind: 'database',
          status: 'pending',
          error: null
        },
        {
          id: 'hub-1',
          name: 'Team Hub',
          kind: 'service-hub',
          status: 'pending',
          error: null
        }
      ])
    );
    expect(state.syncModal.total).toBe(2);

    state = modalsReducer(state, setSyncProviderStatus({ id: 'db-1', status: 'syncing' }));
    expect(state.syncModal.providers[0]?.status).toBe('syncing');

    state = modalsReducer(
      state,
      setSyncProviderStatus({ id: 'db-1', status: 'success', error: null })
    );
    state = modalsReducer(state, incrementSyncCompleted());
    expect(state.syncModal.completed).toBe(1);

    state = modalsReducer(
      state,
      setSyncProviderStatus({ id: 'hub-1', status: 'error', error: 'Connection refused' })
    );
    state = modalsReducer(state, incrementSyncCompleted());
    state = modalsReducer(state, finishSync());
    expect(state.syncModal.running).toBe(false);
    expect(state.syncModal.providers[1]?.error).toBe('Connection refused');

    state = modalsReducer(state, closeSyncModal());
    expect(state.syncModal.open).toBe(false);
  });
});
