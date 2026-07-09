import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/harborclient-test-user-data'
  }
}));

import {
  configureFileLogger,
  getDefaultLogFilePath,
  writeRequestLog,
  writeVerboseLog
} from '#/main/fileLogger';

describe('fileLogger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harborclient-file-logger-'));
    configureFileLogger({ logFilePath: '' });
  });

  afterEach(() => {
    configureFileLogger({ logFilePath: '' });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the default log file path under userData', () => {
    expect(getDefaultLogFilePath()).toBe('/tmp/harborclient-test-user-data/logs/harborclient.log');
  });

  it('writes verbose and request messages when configured', async () => {
    const logPath = join(tempDir, 'harborclient.log');
    configureFileLogger({ logFilePath: logPath });

    writeVerboseLog('startup', { step: 1 });
    writeRequestLog('GET', 'https://example.com');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const files = readdirSync(tempDir);
    expect(files.some((name) => name.startsWith('harborclient'))).toBe(true);

    const logFile = files.find((name) => name.startsWith('harborclient'));
    expect(logFile).toBeDefined();
    const contents = readFileSync(join(tempDir, logFile!), 'utf8');
    expect(contents).toContain('[verbose] startup');
    expect(contents).toContain('[request] GET https://example.com');
  });

  it('does not write when logFilePath is empty', async () => {
    configureFileLogger({ logFilePath: '' });
    writeVerboseLog('ignored');

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(readdirSync(tempDir)).toEqual([]);
  });

  it('reconfigures when the log file path changes', async () => {
    const firstPath = join(tempDir, 'first.log');
    const secondPath = join(tempDir, 'second.log');

    configureFileLogger({ logFilePath: firstPath });
    writeVerboseLog('first');

    configureFileLogger({ logFilePath: secondPath });
    writeVerboseLog('second');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const firstContents = readFileSync(
      join(tempDir, readdirSync(tempDir).find((name) => name.startsWith('first'))!),
      'utf8'
    );
    const secondContents = readFileSync(
      join(tempDir, readdirSync(tempDir).find((name) => name.startsWith('second'))!),
      'utf8'
    );

    expect(firstContents).toContain('[verbose] first');
    expect(firstContents).not.toContain('second');
    expect(secondContents).toContain('[verbose] second');
  });
});
