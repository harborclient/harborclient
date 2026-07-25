import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { serializeFormParts } from './formData.js';
import { Body } from './Body.js';

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

  describe('expandMultipartRaw', () => {
    it('expands file tokens into wire bytes and derives Content-Type', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'hc-multipart-raw-'));
      const filePath = join(tempDir, 'upload.txt');
      await writeFile(filePath, 'hello file', 'utf-8');

      const raw =
        `----bound\r\n` +
        `Content-Disposition: form-data; name="file"; filename="upload.txt"\r\n` +
        `\r\n` +
        `<<file:${filePath}>>\r\n` +
        `----bound--`;

      const result = await bodyBuilder.expandMultipartRaw(raw);
      expect(result).toHaveProperty('body');
      if (!('body' in result)) {
        throw new Error('Expected expanded multipart body');
      }

      expect(result.contentType).toBe('multipart/form-data; boundary=--bound');
      const decoded = new TextDecoder().decode(result.body);
      expect(decoded).toContain('hello file');
      expect(decoded).not.toContain('<<file:');
    });

    it('preserves malformed structure and only errors on unreadable files', async () => {
      const ok = await bodyBuilder.expandMultipartRaw('not really multipart');
      expect(ok).toHaveProperty('body');
      if (!('body' in ok)) {
        throw new Error('Expected body for malformed raw');
      }
      expect(ok.contentType).toBe('multipart/form-data');

      const missing = await bodyBuilder.expandMultipartRaw(
        '----b\r\n\r\n<<file:/tmp/does-not-exist-hc-raw.txt>>\r\n----b--'
      );
      expect(missing).toEqual({
        error: 'Failed to read file: /tmp/does-not-exist-hc-raw.txt'
      });
    });
  });
});
