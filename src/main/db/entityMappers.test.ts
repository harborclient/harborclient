import { describe, expect, it } from 'vitest';
import {
  docToCollection,
  docToEnvironment,
  docToFolder,
  docToRequest,
  rowToCollection,
  rowToEnvironment,
  rowToFolder,
  rowToRequest
} from '#/main/db/entityMappers';

describe('entityMappers', () => {
  describe('SQL-shaped rows', () => {
    it('maps a collection row with JSON string columns', () => {
      const row = {
        id: 1,
        name: 'My Collection',
        variables: JSON.stringify([{ key: 'base', value: 'https://example.com', share: true }]),
        headers: JSON.stringify([{ key: 'Accept', value: 'application/json', enabled: true }]),
        pre_request_script: 'console.log("pre")',
        post_request_script: '',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      expect(rowToCollection(row)).toEqual({
        id: 1,
        name: 'My Collection',
        variables: [{ key: 'base', value: 'https://example.com', defaultValue: '', share: true }],
        headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
        pre_request_script: 'console.log("pre")',
        post_request_script: '',
        created_at: '2024-01-01T00:00:00.000Z'
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
        name: 'Production',
        variables: [{ key: 'token', value: 'secret', defaultValue: '', share: false }],
        created_at: '2024-01-02T00:00:00.000Z'
      });
    });

    it('maps a folder row', () => {
      const row = {
        id: 3,
        collection_id: 1,
        name: 'Auth',
        sort_order: 0,
        created_at: '2024-01-03T00:00:00.000Z'
      };

      expect(rowToFolder(row)).toEqual(row);
    });

    it('maps a request row with nullable folder_id and JSON arrays', () => {
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
        comment: 'List users',
        folder_id: null,
        sort_order: 1,
        created_at: '2024-01-04T00:00:00.000Z',
        updated_at: '2024-01-05T00:00:00.000Z'
      };

      expect(rowToRequest(row)).toMatchObject({
        id: 4,
        folder_id: null,
        params: [{ key: 'page', value: '1', enabled: true }],
        comment: 'List users'
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
        created_at: '2024-01-01T00:00:00.000Z'
      };

      expect(rowToCollection(row).variables).toEqual([]);
      expect(rowToCollection(row).headers).toEqual([]);
    });
  });

  describe('Firestore-shaped documents', () => {
    it('maps a collection document via docToCollection', () => {
      const data = {
        name: 'Firestore Collection',
        variables: [{ key: 'env', value: 'dev' }],
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        pre_request_script: '',
        post_request_script: '',
        created_at: '2024-02-01T00:00:00.000Z'
      };

      expect(docToCollection(10, data)).toEqual({
        id: 10,
        name: 'Firestore Collection',
        variables: [{ key: 'env', value: 'dev', defaultValue: '', share: false }],
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        pre_request_script: '',
        post_request_script: '',
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

    it('maps a folder document via docToFolder', () => {
      expect(
        docToFolder(7, {
          collection_id: 10,
          name: 'API',
          sort_order: 2,
          created_at: '2024-02-03T00:00:00.000Z'
        })
      ).toMatchObject({ id: 7, collection_id: 10, name: 'API', sort_order: 2 });
    });

    it('maps a request document with defaults for missing fields', () => {
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
