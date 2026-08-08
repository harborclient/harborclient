import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import winston from 'winston';
import { createLogger } from '#/server/logging/logger.js';

describe('createLogger', () => {
  it('creates a console logger with the configured level', () => {
    const logger = createLogger({ level: 'debug', file: null, console: true, format: 'json' });

    expect(logger.level).toBe('debug');
    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]?.constructor.name).toBe('Console');
  });

  it('creates a file logger when file path is set', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'team-hub-logger-'));
    const filePath = path.join(dir, 'team-hub.log');
    const logger = createLogger({ level: 'info', file: filePath, console: false, format: 'json' });

    expect(logger.level).toBe('info');
    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]?.constructor.name).toBe('File');
  });

  it('uses a silent console transport when both outputs are disabled', () => {
    const logger = createLogger({ level: 'warn', file: null, console: false, format: 'json' });

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]?.constructor.name).toBe('Console');
    expect(logger.transports[0]?.silent).toBe(true);
  });

  it('emits JSON lines when format is json', () => {
    let written = '';
    const stream = new Writable({
      /**
       * Captures formatted log output for assertions.
       *
       * @param chunk - Serialized log chunk.
       * @param _encoding - Stream encoding (unused).
       * @param callback - Completion callback.
       */
      write(chunk, _encoding, callback) {
        written += String(chunk);
        callback();
      }
    });

    const logger = winston.createLogger({
      level: 'info',
      format: createLogger({ level: 'info', file: null, console: false, format: 'json' }).format,
      transports: [new winston.transports.Stream({ stream })]
    });

    logger.info('hello', { reqId: 'abc' });

    const parsed = JSON.parse(written.trim()) as { message: string; reqId: string };
    expect(parsed.message).toBe('hello');
    expect(parsed.reqId).toBe('abc');
  });

  it('emits simple text when format is simple', () => {
    let written = '';
    const stream = new Writable({
      /**
       * Captures formatted log output for assertions.
       *
       * @param chunk - Serialized log chunk.
       * @param _encoding - Stream encoding (unused).
       * @param callback - Completion callback.
       */
      write(chunk, _encoding, callback) {
        written += String(chunk);
        callback();
      }
    });

    const logger = createLogger({ level: 'info', file: null, console: false, format: 'simple' });
    logger.clear();
    logger.add(new winston.transports.Stream({ stream }));
    logger.info('hello');

    expect(written).toContain('info: hello');
    expect(written.trim().startsWith('{')).toBe(false);
  });
});
