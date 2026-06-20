import { describe, expect, it } from 'vitest';
import {
  emptyFormPart,
  normalizeFormPart,
  parseFormParts,
  serializeFormParts
} from '#/shared/formData';

describe('parseFormParts', () => {
  it('returns an empty array for blank or invalid JSON', () => {
    expect(parseFormParts('')).toEqual([]);
    expect(parseFormParts('   ')).toEqual([]);
    expect(parseFormParts('not-json')).toEqual([]);
    expect(parseFormParts('{"key":"value"}')).toEqual([]);
  });

  it('normalizes partial records and filters invalid file entries', () => {
    const parts = parseFormParts(
      JSON.stringify([
        { key: 'name', value: 'Ada', enabled: true, type: 'text' },
        { key: 'avatar', type: 'file', files: ['/tmp/a.png', 42, null] },
        { enabled: false }
      ])
    );

    expect(parts).toEqual([
      { key: 'name', value: 'Ada', enabled: true, type: 'text', files: [] },
      { key: 'avatar', value: '', enabled: true, type: 'file', files: ['/tmp/a.png'] },
      { key: '', value: '', enabled: false, type: 'text', files: [] }
    ]);
  });
});

describe('serializeFormParts', () => {
  it('returns an empty string when there are no parts', () => {
    expect(serializeFormParts([])).toBe('');
  });

  it('serializeFormParts output parses back to equivalent parts via parseFormParts', () => {
    const parts = [
      emptyFormPart(),
      { key: 'title', value: '{{name}}', enabled: true, type: 'text' as const, files: [] },
      {
        key: 'files',
        value: '',
        enabled: true,
        type: 'file' as const,
        files: ['/home/user/doc.pdf']
      }
    ];

    expect(parseFormParts(serializeFormParts(parts))).toEqual(parts.map(normalizeFormPart));
  });
});

describe('emptyFormPart', () => {
  it('returns a blank enabled text row', () => {
    expect(emptyFormPart()).toEqual({
      key: '',
      value: '',
      enabled: true,
      type: 'text',
      files: []
    });
  });
});
