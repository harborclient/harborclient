import { describe, expect, it } from 'vitest';
import { normalizeCollectionImportUrl, parseCollectionUrlContents } from './fetchCollectionUrl';

describe('normalizeCollectionImportUrl', () => {
  it('trims and accepts absolute http(s) URLs', () => {
    expect(normalizeCollectionImportUrl('  https://localhost:5009/assets/postman.json  ')).toBe(
      'https://localhost:5009/assets/postman.json'
    );
  });

  it('rejects empty input', () => {
    expect(() => normalizeCollectionImportUrl('   ')).toThrow('Enter a URL to import.');
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeCollectionImportUrl('file:///tmp/collection.json')).toThrow(
      'Collection URLs must use http:// or https://.'
    );
  });
});

describe('parseCollectionUrlContents', () => {
  it('parses JSON collection payloads', () => {
    const parsed = parseCollectionUrlContents(
      JSON.stringify({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Demo',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        requests: []
      })
    );
    expect(parsed).toMatchObject({ name: 'Demo', harborclientExport: 'collection' });
  });

  it('parses YAML OpenCollection payloads', () => {
    const parsed = parseCollectionUrlContents(`
opencollection: "1.0.0"
info:
  name: Open Demo
`);
    expect(parsed).toMatchObject({
      opencollection: '1.0.0',
      info: { name: 'Open Demo' }
    });
  });

  it('rejects empty responses', () => {
    expect(() => parseCollectionUrlContents('   ')).toThrow('empty response');
  });
});
