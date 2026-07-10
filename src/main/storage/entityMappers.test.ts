import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { FOLDER_SETTINGS_DEFAULTS } from '#/shared/testFixtures/folder';
import {
  docToCollection,
  docToEnvironment,
  docToFolder,
  docToRequest,
  rowToCollection,
  rowToEnvironment,
  rowToFolder,
  rowToRequest
} from '#/main/storage/entityMappers';

describe('entityMappers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('numeric coercion', () => {
    it('parses string numeric IDs from database drivers', () => {
      expect(rowToCollection({ id: '42', name: 'Test' })).toMatchObject({ id: 42 });
      expect(
        rowToFolder({ id: '3', collection_id: '1', name: 'Auth', sort_order: '0' })
      ).toMatchObject({
        id: 3,
        collection_id: 1,
        sort_order: 0
      });
      expect(
        rowToRequest({
          id: '4',
          collection_id: '1',
          name: 'Get users',
          folder_id: '7'
        })
      ).toMatchObject({
        id: 4,
        collection_id: 1,
        folder_id: 7
      });
    });

    it('warns and uses fallback when a required numeric field is not coercible', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(rowToCollection({ id: 'not-a-number', name: 'Broken' })).toMatchObject({ id: 0 });

      expect(warn).toHaveBeenCalledWith(
        'Failed to coerce database field to number, using fallback:',
        { value: 'not-a-number', fallback: 0 }
      );
    });

    it('warns and returns null when a nullable numeric field is not coercible', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(
        rowToRequest({
          id: 1,
          collection_id: 1,
          name: 'Broken folder',
          folder_id: 'not-a-number'
        }).folder_id
      ).toBeNull();

      expect(warn).toHaveBeenCalledWith(
        'Failed to coerce nullable database field to number:',
        'not-a-number'
      );
    });
  });

  describe('SQL-shaped rows', () => {
    it('rowToCollection parses JSON headers and variables into arrays', () => {
      const row = {
        id: 1,
        name: 'My Collection',
        variables: JSON.stringify([{ key: 'base', value: 'https://example.com', share: true }]),
        headers: JSON.stringify([{ key: 'Accept', value: 'application/json', enabled: true }]),
        pre_request_script: 'console.log("pre")',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        created_at: '2024-01-01T00:00:00.000Z'
      };

      const result = rowToCollection(row);

      expect(result).toMatchObject({
        id: 1,
        uuid: '',
        name: 'My Collection',
        variables: [{ key: 'base', value: 'https://example.com', defaultValue: '', share: true }],
        headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
        auth: defaultAuth(),
        pre_request_script: 'console.log("pre")',
        post_request_script: '',
        post_request_scripts: [],
        created_at: '2024-01-01T00:00:00.000Z'
      });
      expect(result.pre_request_scripts).toHaveLength(1);
      expect(result.pre_request_scripts[0]).toMatchObject({
        enabled: true,
        kind: 'inline',
        code: 'console.log("pre")'
      });
    });

    it('maps an environment row with JSON string variables', () => {
      const row = {
        id: 2,
        name: 'Production',
        variables: JSON.stringify([{ key: 'token', value: 'secret' }]),
        created_at: '2024-01-02T00:00:00.000Z'
      };

      expect(rowToEnvironment(row)).toEqual({
        id: 2,
        uuid: '',
        name: 'Production',
        variables: [{ key: 'token', value: 'secret', defaultValue: '', share: false }],
        created_at: '2024-01-02T00:00:00.000Z'
      });
    });

    it('rowToFolder returns Folder with id, uuid, name, and sort_order', () => {
      const row = {
        id: 3,
        uuid: '55555555-5555-4555-8555-555555555555',
        collection_id: 1,
        name: 'Auth',
        sort_order: 0,
        created_at: '2024-01-03T00:00:00.000Z'
      };

      expect(rowToFolder(row)).toEqual({
        ...row,
        ...FOLDER_SETTINGS_DEFAULTS
      });
    });

    it('rowToRequest parses nullable folder_id and JSON header/param arrays', () => {
      const row = {
        id: 4,
        collection_id: 1,
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com/users',
        headers: JSON.stringify([]),
        params: JSON.stringify([{ key: 'page', value: '1', enabled: true }]),
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: 'List users',
        tags: '',
        folder_id: null,
        sort_order: 1,
        created_at: '2024-01-04T00:00:00.000Z',
        updated_at: '2024-01-05T00:00:00.000Z'
      };

      expect(rowToRequest(row)).toMatchObject({
        id: 4,
        folder_id: null,
        params: [{ key: 'page', value: '1', enabled: true }],
        comment: 'List users',
        tags: ''
      });
    });

    it('falls back to empty arrays for malformed JSON strings', () => {
      const row = {
        id: 1,
        name: 'Broken',
        variables: '{not json',
        headers: '[]',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        created_at: '2024-01-01T00:00:00.000Z'
      };

      expect(rowToCollection(row).variables).toEqual([]);
      expect(rowToCollection(row).headers).toEqual([]);
    });
  });

  describe('Firestore-shaped documents', () => {
    it('docToCollection returns Collection with parsed variables and headers', () => {
      const data = {
        name: 'Firestore Collection',
        variables: [{ key: 'env', value: 'dev' }],
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        created_at: '2024-02-01T00:00:00.000Z'
      };

      expect(docToCollection(10, data)).toEqual({
        id: 10,
        uuid: '',
        name: 'Firestore Collection',
        variables: [{ key: 'env', value: 'dev', defaultValue: '', share: false }],
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        auth: defaultAuth(),
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        created_at: '2024-02-01T00:00:00.000Z'
      });
    });

    it('maps an environment document via docToEnvironment', () => {
      expect(
        docToEnvironment(5, {
          name: 'Staging',
          variables: [],
          created_at: '2024-02-02T00:00:00.000Z'
        })
      ).toMatchObject({ id: 5, name: 'Staging', variables: [] });
    });

    it('docToFolder returns Folder with collection_id and sort_order', () => {
      expect(
        docToFolder(7, {
          collection_id: 10,
          name: 'API',
          sort_order: 2,
          created_at: '2024-02-03T00:00:00.000Z'
        })
      ).toMatchObject({ id: 7, collection_id: 10, name: 'API', sort_order: 2 });
    });

    it('docToRequest fills empty strings and none body_type when fields are missing', () => {
      const mapped = docToRequest(99, {
        collection_id: 10,
        name: 'Health check',
        folder_id: 7
      });

      expect(mapped).toMatchObject({
        id: 99,
        collection_id: 10,
        name: 'Health check',
        method: 'GET',
        url: '',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        folder_id: 7,
        sort_order: 0
      });
      expect(mapped.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(mapped.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('treats non-array variables as empty', () => {
      expect(docToCollection(1, { name: 'Test', variables: 'not-an-array' }).variables).toEqual([]);
    });
  });
});
