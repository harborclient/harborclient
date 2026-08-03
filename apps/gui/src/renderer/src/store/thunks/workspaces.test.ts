import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import { createTab, type RequestTab } from '#/renderer/src/store/tabs';
import { draftFromSaved } from '#/renderer/src/store/tabs';
import type { SavedRequest } from '@harborclient/core/types';
import {
  buildWorkspaceExport,
  resolveWorkspaceMembersFromOpenTabs,
  resolveWorkspaceMembersFromRequests
} from './workspaces';
import type { Workspace } from '@harborclient/core/types/workspace';
import { validateWorkspaceExport } from '@harborclient/core/types/workspace';

const savedRequest: SavedRequest = {
  id: 7,
  uuid: 'request-uuid-7',
  collection_id: 3,
  folder_id: null,
  name: 'Get users',
  protocol: 'http' as const,
  method: 'GET',
  url: 'https://example.com/users',
  headers: [],
  params: [],
  auth: defaultAuth(),
  userAgent: '',
  body: '',
  body_type: 'none',
  body_raw: null,
  body_raw_open: false,
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('resolveWorkspaceMembersFromOpenTabs', () => {
  it('returns saved request members for open tabs only and dedupes by uuid', () => {
    const savedTab = createTab(draftFromSaved(savedRequest)) as RequestTab;
    const duplicateSavedTab = createTab(draftFromSaved(savedRequest)) as RequestTab;
    const unsavedTab = createTab();
    const pageTab = {
      tabId: 'page-tab',
      kind: 'page' as const,
      page: { type: 'settings' as const, section: 'general' as const }
    };

    const members = resolveWorkspaceMembersFromOpenTabs(
      [savedTab, duplicateSavedTab, unsavedTab, pageTab],
      { 3: [savedRequest] }
    );

    expect(members).toEqual([
      {
        requestUuid: 'request-uuid-7',
        collectionId: 3,
        requestName: 'Get users'
      }
    ]);
  });
});

describe('resolveWorkspaceMembersFromRequests', () => {
  it('builds workspace members from saved requests in caller order', () => {
    const secondRequest: SavedRequest = {
      ...savedRequest,
      id: 8,
      uuid: 'request-uuid-8',
      collection_id: 4,
      name: 'Create user'
    };

    expect(resolveWorkspaceMembersFromRequests([secondRequest, savedRequest])).toEqual([
      {
        requestUuid: 'request-uuid-8',
        collectionId: 4,
        requestName: 'Create user'
      },
      {
        requestUuid: 'request-uuid-7',
        collectionId: 3,
        requestName: 'Get users'
      }
    ]);
  });
});

describe('buildWorkspaceExport', () => {
  it('builds a version 2 export envelope with request uuids and layout', () => {
    const groups: Workspace[] = [
      {
        id: 1,
        name: 'Auth flows',
        requests: [
          { requestUuid: 'uuid-1', collectionId: 1, requestName: 'Login' },
          { requestUuid: 'uuid-2', collectionId: 1, requestName: 'Refresh' }
        ],
        createdAt: 1,
        updatedAt: 1,
        layout: null
      }
    ];

    const envelope = buildWorkspaceExport(1, groups);

    expect(envelope).toEqual({
      harborclientVersion: 2,
      harborclientExport: 'workspace',
      name: 'Auth flows',
      requestUuids: ['uuid-1', 'uuid-2'],
      marker: null,
      layout: null
    });
    expect(validateWorkspaceExport(envelope)).toEqual(envelope);
  });
});
