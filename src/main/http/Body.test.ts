import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { serializeFormParts } from '#/shared/formData';
import { serializeUrlEncodedParts } from '#/shared/urlencoded';
import { Body } from '#/main/http/Body';

describe('Body', () => {
  const bodyBuilder = new Body();

  describe('buildMultipart', () => {
    it('builds FormData with text and file parts', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'hc-multipart-'));
      const filePath = join(tempDir, 'upload.txt');
      await writeFile(filePath, 'hello file', 'utf-8');

      const body = serializeFormParts([
        { key: 'name', value: 'Ada', enabled: true, type: 'text', files: [] },
        { key: 'file', value: '', enabled: true, type: 'file', files: [filePath] }
      ]);

      const result = await bodyBuilder.buildMultipart(body);

      expect(result).toHaveProperty('formData');
      if (!('formData' in result)) {
        throw new Error('Expected multipart FormData result');
      }

      expect(result.formData.get('name')).toBe('Ada');
      expect(result.formData.get('file')).toBeInstanceOf(Blob);
    });

    it('returns an error when a file cannot be read', async () => {
      const body = serializeFormParts([
        {
          key: 'file',
          value: '',
          enabled: true,
          type: 'file',
          files: ['/tmp/does-not-exist-hc-multipart.txt']
        }
      ]);

      const result = await bodyBuilder.buildMultipart(body);

      expect(result).toEqual({
        error: 'Failed to read file: /tmp/does-not-exist-hc-multipart.txt'
      });
    });
  });

  describe('summarizeFormParts', () => {
    it('summarizes multipart parts for request preview', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'hc-multipart-'));
      const filePath = join(tempDir, 'upload.txt');
      await writeFile(filePath, 'hello file', 'utf-8');

      const body = serializeFormParts([
        { key: 'name', value: 'Ada', enabled: true, type: 'text', files: [] },
        { key: 'file', value: '', enabled: true, type: 'file', files: [filePath] }
      ]);

      expect(bodyBuilder.summarizeFormParts(body)).toBe('name: Ada\nfile: [upload.txt]');
    });
  });

  describe('buildUrlEncoded', () => {
    it('builds application/x-www-form-urlencoded body from key-value rows', () => {
      const body = serializeUrlEncodedParts([
        { key: 'name', value: 'Ada Lovelace', enabled: true },
        { key: 'disabled', value: 'ignored', enabled: false },
        { key: '  ', value: 'blank key', enabled: true },
        { key: 'tags', value: 'a&b=c', enabled: true }
      ]);

      expect(bodyBuilder.buildUrlEncoded(body)).toBe('name=Ada+Lovelace&tags=a%26b%3Dc');
    });
  });
});
