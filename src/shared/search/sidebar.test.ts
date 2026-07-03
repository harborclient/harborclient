import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection, Environment, Folder, SavedRequest } from '#/shared/types';
import {
  buildSidebarSearchIndex,
  searchSidebar,
  searchSidebarEntities,
  sidebarRequestBreadcrumb
} from '#/shared/search/sidebar';

const collectionA: Collection = {
  id: 1,
  uuid: 'col-a',
  name: 'Public API',
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const collectionB: Collection = {
  id: 2,
  uuid: 'col-b',
  name: 'Internal Tools',
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const folderUsers: Folder = {
  id: 10,
  collection_id: 1,
  uuid: 'folder-users',
  name: 'Users',
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z'
};

const requestListUsers: SavedRequest = {
  id: 100,
  uuid: 'req-list-users',
  collection_id: 1,
  name: 'Fetch inventory list',
  method: 'GET',
  url: 'https://inventory.beta.local/items',
  headers: [],
  params: [],
  auth: defaultAuth(),
  body: '',
  body_type: 'none',
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  folder_id: 10,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

const requestCreateUser: SavedRequest = {
  id: 101,
  uuid: 'req-create-user',
  collection_id: 1,
  name: 'Submit payment',
  method: 'POST',
  url: 'https://payments.gamma.local/charges',
  headers: [],
  params: [],
  auth: defaultAuth(),
  body: '{}',
  body_type: 'json',
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: 'Requires OAuth token refresh before send',
  tags: 'oauth, payments',
  folder_id: 10,
  sort_order: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

const requestHealth: SavedRequest = {
  id: 102,
  uuid: 'req-health',
  collection_id: 1,
  name: 'Health check',
  method: 'GET',
  url: 'https://health.delta.local/status',
  headers: [],
  params: [],
  auth: defaultAuth(),
  body: '',
  body_type: 'none',
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  folder_id: null,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

const environmentProd: Environment = {
  id: 200,
  uuid: 'env-prod',
  name: 'Production',
  variables: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const environmentStaging: Environment = {
  id: 201,
  uuid: 'env-staging',
  name: 'Staging',
  variables: [],
  created_at: '2024-01-01T00:00:00.000Z'
};

const sampleInput = {
  collections: [collectionA, collectionB],
  foldersByCollection: {
    1: [folderUsers]
  },
  requestsByCollection: {
    1: [requestListUsers, requestCreateUser, requestHealth]
  },
  environments: [environmentProd, environmentStaging]
};

describe('searchSidebar', () => {
  const index = buildSidebarSearchIndex(sampleInput);

  it('returns null when the query is empty or whitespace', () => {
    expect(searchSidebar(sampleInput, index, '')).toBeNull();
    expect(searchSidebar(sampleInput, index, '   ')).toBeNull();
  });

  it('matches collections by name and includes all loaded descendants', () => {
    const filter = searchSidebar(sampleInput, index, 'Public API');
    expect(filter).not.toBeNull();
    expect(filter?.collectionIds.has(1)).toBe(true);
    expect(filter?.folderIds.has(10)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(true);
    expect(filter?.requestIds.has(101)).toBe(true);
    expect(filter?.requestIds.has(102)).toBe(true);
    expect(filter?.collectionIds.has(2)).toBe(false);
  });

  it('matches folders by name and includes all requests in the folder', () => {
    const filter = searchSidebar(sampleInput, index, 'Users');
    expect(filter?.collectionIds.has(1)).toBe(true);
    expect(filter?.folderIds.has(10)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(true);
    expect(filter?.requestIds.has(101)).toBe(true);
    expect(filter?.requestIds.has(102)).toBe(false);
  });

  it('matches requests by name and reveals ancestors only', () => {
    const filter = searchSidebar(sampleInput, index, 'inventory list');
    expect(filter?.collectionIds.has(1)).toBe(true);
    expect(filter?.folderIds.has(10)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(true);
    expect(filter?.requestIds.has(101)).toBe(false);
  });

  it('matches requests by url', () => {
    const hits = index.search('health.delta.local/status');
    const filter = searchSidebar(sampleInput, index, 'health.delta.local/status');
    expect(hits.map((hit) => hit.id)).toEqual(['request:102']);
    expect(filter?.requestIds.has(102)).toBe(true);
    expect(filter?.collectionIds.has(1)).toBe(true);
    expect(filter?.folderIds.has(10)).toBe(false);
  });

  it('matches requests by method', () => {
    const filter = searchSidebar(sampleInput, index, 'POST');
    expect(filter?.requestIds.has(101)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(false);
  });

  it('matches requests by comment notes', () => {
    const filter = searchSidebar(sampleInput, index, 'OAuth token refresh');
    expect(filter?.collectionIds.has(1)).toBe(true);
    expect(filter?.folderIds.has(10)).toBe(true);
    expect(filter?.requestIds.has(101)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(false);
    expect(filter?.requestIds.has(102)).toBe(false);
  });

  it('matches requests by tags', () => {
    const filter = searchSidebar(sampleInput, index, 'payments');
    expect(filter?.requestIds.has(101)).toBe(true);
    expect(filter?.requestIds.has(100)).toBe(false);
  });

  it('matches environments independently from collections', () => {
    const filter = searchSidebar(sampleInput, index, 'Production');
    expect(filter?.environmentIds.has(200)).toBe(true);
    expect(filter?.collectionIds.size).toBe(0);
  });

  it('returns empty visibility sets when nothing matches', () => {
    const filter = searchSidebar(sampleInput, index, 'zzzzzzzzzzzz');
    expect(filter?.collectionIds.size).toBe(0);
    expect(filter?.folderIds.size).toBe(0);
    expect(filter?.requestIds.size).toBe(0);
    expect(filter?.environmentIds.size).toBe(0);
  });
});

describe('searchSidebarEntities', () => {
  const index = buildSidebarSearchIndex(sampleInput);

  it('returns request hits when comment notes match', () => {
    const hits = searchSidebarEntities(sampleInput, index, 'OAuth token refresh');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      kind: 'request',
      entityId: 101,
      name: 'Submit payment',
      method: 'POST',
      collectionId: 1,
      folderId: 10
    });
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it('returns request hits when tags match', () => {
    const hits = searchSidebarEntities(sampleInput, index, 'oauth');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.entityId).toBe(101);
  });
});

describe('sidebarRequestBreadcrumb', () => {
  it('returns collection name for root-level requests', () => {
    expect(sidebarRequestBreadcrumb(sampleInput, 1, null)).toEqual({
      collectionName: 'Public API',
      folderName: undefined
    });
  });

  it('returns collection and folder names for nested requests', () => {
    expect(sidebarRequestBreadcrumb(sampleInput, 1, 10)).toEqual({
      collectionName: 'Public API',
      folderName: 'Users'
    });
  });

  it('returns empty names when collection id is missing or unknown', () => {
    expect(sidebarRequestBreadcrumb(sampleInput, undefined, null)).toEqual({});
    expect(sidebarRequestBreadcrumb(sampleInput, 999, null)).toEqual({
      collectionName: undefined,
      folderName: undefined
    });
  });
});
