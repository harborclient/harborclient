import { describe, expect, it } from 'vitest';
import { defaultAuth } from '../auth';
import { FOLDER_SETTINGS_DEFAULTS } from '../testFixtures/folder';
import type { Collection, Environment, Folder, SavedRequest } from '../types';
import {
  buildSidebarSearchIndex,
  formatArchivedCollectionLabel,
  isArchivedCollection,
  partitionSidebarSearchFilter,
  searchSidebar,
  searchSidebarEntities,
  sidebarEntitySubtitle,
  sidebarRequestBreadcrumb
} from './sidebar';
import { searchTextIndex } from './oramaIndex';
import type { SidebarSearchDocument } from './sidebar';

const collectionA: Collection = {
  id: 1,
  uuid: 'col-a',
  name: 'Public API',
  variables: [],
  headers: [],
  userAgent: '',
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
  userAgent: '',
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
  created_at: '2024-01-01T00:00:00.000Z',
  ...FOLDER_SETTINGS_DEFAULTS
};

const requestListUsers: SavedRequest = {
  id: 100,
  uuid: 'req-list-users',
  collection_id: 1,
  name: 'Fetch inventory list',
  protocol: 'http' as const,
  method: 'GET',
  url: 'https://inventory.beta.local/items',
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
  protocol: 'http' as const,
  method: 'POST',
  url: 'https://payments.gamma.local/charges',
  headers: [],
  params: [],
  auth: defaultAuth(),
  userAgent: '',
  body: '{}',
  body_type: 'json',
  body_raw: null,
  body_raw_open: false,
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
  protocol: 'http' as const,
  method: 'GET',
  url: 'https://health.delta.local/status',
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

  it('reveals every folder ancestor for nested request and folder matches', () => {
    const nestedFolder: Folder = {
      ...folderUsers,
      id: 11,
      uuid: 'folder-admins',
      name: 'Admins',
      parent_folder_id: folderUsers.id
    };
    const nestedRequest: SavedRequest = {
      ...requestListUsers,
      id: 103,
      uuid: 'req-admin-report',
      name: 'Nested admin report',
      folder_id: nestedFolder.id
    };
    const nestedInput = {
      ...sampleInput,
      foldersByCollection: { 1: [folderUsers, nestedFolder] },
      requestsByCollection: {
        1: [requestListUsers, requestCreateUser, requestHealth, nestedRequest]
      }
    };
    const nestedIndex = buildSidebarSearchIndex(nestedInput);

    const requestFilter = searchSidebar(nestedInput, nestedIndex, 'Nested admin report');
    expect([...requestFilter!.folderIds]).toEqual([11, 10]);

    const folderFilter = searchSidebar(nestedInput, nestedIndex, 'Admins');
    expect([...folderFilter!.folderIds]).toEqual([11, 10]);
  });

  it('matches requests by url', () => {
    const hits = searchTextIndex<SidebarSearchDocument>(index, 'health.delta.local/status', {
      properties: ['name', 'url', 'method', 'comment', 'tags'],
      threshold: 0
    });
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

describe('buildSidebarSearchIndex', () => {
  it('dedupes duplicate request ids across collection caches', () => {
    const gitCollectionA: Collection = {
      ...collectionA,
      id: 8_000_000_002,
      uuid: 'col-git-a',
      name: 'Git Collection A'
    };
    const gitCollectionB: Collection = {
      ...collectionB,
      id: 8_000_000_003,
      uuid: 'col-git-b',
      name: 'Git Collection B'
    };
    const canonicalRequest: SavedRequest = {
      ...requestListUsers,
      id: 8_000_000_001,
      uuid: 'req-git-canonical',
      collection_id: 8_000_000_002,
      name: 'Git Synced Request',
      url: 'https://api.example.com/git-synced'
    };
    const staleRequest: SavedRequest = {
      ...canonicalRequest,
      name: 'Stale cache copy'
    };
    const input = {
      collections: [gitCollectionA, gitCollectionB],
      foldersByCollection: {},
      requestsByCollection: {
        [8_000_000_002]: [canonicalRequest],
        [8_000_000_003]: [staleRequest]
      },
      environments: [] as Environment[]
    };

    const index = buildSidebarSearchIndex(input);
    const hits = searchTextIndex<SidebarSearchDocument>(index, 'Git Synced Request', {
      properties: ['name', 'url', 'method', 'comment', 'tags'],
      threshold: 0
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('request:8000000001');
    expect(hits[0]?.document.name).toBe('Git Synced Request');
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

  it('returns the full folder path for deeply nested requests', () => {
    const nestedFolder: Folder = {
      ...folderUsers,
      id: 11,
      uuid: 'folder-admins',
      name: 'Admins',
      parent_folder_id: folderUsers.id
    };
    const nestedInput = {
      ...sampleInput,
      foldersByCollection: { 1: [folderUsers, nestedFolder] }
    };

    expect(sidebarRequestBreadcrumb(nestedInput, 1, 11)).toEqual({
      collectionName: 'Public API',
      folderName: 'Users / Admins'
    });
    expect(
      sidebarEntitySubtitle(nestedInput, {
        kind: 'folder',
        collectionId: 1,
        folderId: 11
      })
    ).toBe('Public API / Users');
  });

  it('returns empty names when collection id is missing or unknown', () => {
    expect(sidebarRequestBreadcrumb(sampleInput, undefined, null)).toEqual({});
    expect(sidebarRequestBreadcrumb(sampleInput, 999, null)).toEqual({
      collectionName: undefined,
      folderName: undefined
    });
  });

  it('prefixes archived collection names', () => {
    const archivedInput = {
      ...sampleInput,
      collections: [{ ...collectionA, archived: true }, collectionB]
    };
    expect(sidebarRequestBreadcrumb(archivedInput, 1, 10)).toEqual({
      collectionName: 'Archived: Public API',
      folderName: 'Users'
    });
  });
});

describe('archived search helpers', () => {
  const archivedCollection: Collection = {
    ...collectionB,
    archived: true
  };
  const archivedFolder: Folder = {
    id: 20,
    collection_id: 2,
    uuid: 'folder-legacy',
    name: 'Legacy',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    ...FOLDER_SETTINGS_DEFAULTS
  };
  const archivedRequest: SavedRequest = {
    ...requestHealth,
    id: 200,
    uuid: 'req-archived',
    collection_id: 2,
    name: 'Legacy health',
    folder_id: 20,
    url: 'https://legacy.example.com/health'
  };
  const archivedInput = {
    collections: [collectionA, archivedCollection],
    foldersByCollection: {
      1: [folderUsers],
      2: [archivedFolder]
    },
    requestsByCollection: {
      1: [requestListUsers, requestCreateUser, requestHealth],
      2: [archivedRequest]
    },
    environments: [environmentProd, environmentStaging]
  };

  it('formatArchivedCollectionLabel prefixes the name', () => {
    expect(formatArchivedCollectionLabel('Old API')).toBe('Archived: Old API');
  });

  it('isArchivedCollection detects archived collections', () => {
    expect(isArchivedCollection(archivedInput, 2)).toBe(true);
    expect(isArchivedCollection(archivedInput, 1)).toBe(false);
    expect(isArchivedCollection(archivedInput, undefined)).toBe(false);
  });

  it('partitionSidebarSearchFilter splits active and archived matches', () => {
    const index = buildSidebarSearchIndex(archivedInput);
    const filter = searchSidebar(archivedInput, index, 'Legacy');
    expect(filter).not.toBeNull();
    const partitioned = partitionSidebarSearchFilter(archivedInput, filter!);
    expect([...partitioned.archived.collectionIds]).toEqual([2]);
    expect([...partitioned.archived.folderIds]).toEqual([20]);
    expect([...partitioned.archived.requestIds]).toEqual([200]);
    expect(partitioned.active.collectionIds.size).toBe(0);
    expect(partitioned.active.environmentIds.size).toBe(0);
  });

  it('sidebarEntitySubtitle prefixes archived collection names', () => {
    expect(
      sidebarEntitySubtitle(archivedInput, {
        kind: 'folder',
        collectionId: 2,
        folderId: 20
      })
    ).toBe('Archived: Internal Tools');
    expect(
      sidebarEntitySubtitle(archivedInput, {
        kind: 'request',
        collectionId: 2,
        folderId: 20
      })
    ).toBe('Archived: Internal Tools / Legacy');
  });
});
