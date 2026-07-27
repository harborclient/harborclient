import { describe, expect, it } from 'vitest';
import {
  buildRequestBodyReferenceToken,
  requestBodySelectionLabel,
  requestBodySelectionSourceText
} from './bodySelection';

describe('requestBodySelectionLabel', () => {
  it('returns type-specific labels for each body editor', () => {
    expect(requestBodySelectionLabel('json')).toBe('JSON body');
    expect(requestBodySelectionLabel('text')).toBe('Text body');
    expect(requestBodySelectionLabel('multipart')).toBe('Raw multipart body');
    expect(requestBodySelectionLabel('urlencoded')).toBe('Raw urlencoded body');
    expect(requestBodySelectionLabel('none')).toBe('Raw body');
  });
});

describe('requestBodySelectionSourceText', () => {
  it('uses the main body field for json and text selections', () => {
    expect(requestBodySelectionSourceText('json', '{"a":1}', 'ignored-raw')).toBe('{"a":1}');
    expect(requestBodySelectionSourceText('text', 'hello', 'ignored-raw')).toBe('hello');
  });

  it('uses the projected raw text for multipart and urlencoded selections', () => {
    expect(requestBodySelectionSourceText('multipart', '[]', 'raw-multipart')).toBe(
      'raw-multipart'
    );
    expect(requestBodySelectionSourceText('urlencoded', '[]', 'a=1')).toBe('a=1');
  });
});

describe('buildRequestBodyReferenceToken', () => {
  it('builds an @body token with character offsets', () => {
    expect(buildRequestBodyReferenceToken(10, 42)).toBe('@body#10.42');
  });
});
