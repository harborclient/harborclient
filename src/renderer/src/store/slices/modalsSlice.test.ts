import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import modalsReducer, {
  closeAboutModal,
  closeCollectionModal,
  closeInviteModal,
  openAboutModal,
  openCollectionModal,
  openInviteModal,
  setAboutVersion,
  setCollectionModalInviteTokenInput,
  setCollectionModalName,
  setCollectionModalTab,
  setInviteRecipientKid,
  setPendingLoadRequest,
  setQuitPrompt
} from '#/renderer/src/store/slices/modalsSlice';

describe('modalsSlice', () => {
  it('starts with all modals closed', () => {
    const state = modalsReducer(undefined, { type: 'unknown' });
    expect(state.collectionModal).toBeNull();
    expect(state.invite).toBeNull();
    expect(state.pendingLoadRequest).toBeNull();
    expect(state.quitPrompt).toBeNull();
    expect(state.about).toEqual({ open: false, version: '' });
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
      inviteTokenInput: ''
    });

    state = modalsReducer(state, setCollectionModalName('My API'));
    expect(state.collectionModal?.name).toBe('My API');

    state = modalsReducer(state, setCollectionModalTab('import'));
    expect(state.collectionModal?.tab).toBe('import');

    state = modalsReducer(state, setCollectionModalInviteTokenInput('token'));
    expect(state.collectionModal?.inviteTokenInput).toBe('token');

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
});
