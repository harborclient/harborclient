import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeVerboseLog = vi.fn();
const writeRequestLog = vi.fn();

vi.mock('#/main/fileLogger', () => ({
  writeVerboseLog: (...args: unknown[]) => writeVerboseLog(...args),
  writeRequestLog: (...args: unknown[]) => writeRequestLog(...args)
}));

describe('logger', () => {
  beforeEach(() => {
    writeVerboseLog.mockReset();
    writeRequestLog.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.argv = ['node', 'test'];
  });

  it('writes verbose logs to the file logger even when verbose mode is off', async () => {
    process.argv = ['node', 'test'];
    const { logVerbose } = await import('#/main/logger');

    logVerbose('startup step');

    expect(writeVerboseLog).toHaveBeenCalledWith('startup step');
  });

  it('writes request logs to the file logger even when very-verbose mode is off', async () => {
    process.argv = ['node', 'test'];
    const { logRequest } = await import('#/main/logger');

    logRequest('POST', 'https://example.com/api');

    expect(writeRequestLog).toHaveBeenCalledWith('POST', 'https://example.com/api');
  });

  it('mirrors verbose logs to console when verbose mode is enabled', async () => {
    process.argv = ['node', 'test', '-v'];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { logVerbose } = await import('#/main/logger');

    logVerbose('visible');

    expect(writeVerboseLog).toHaveBeenCalledWith('visible');
    expect(consoleSpy).toHaveBeenCalledWith('[verbose]', 'visible');
    consoleSpy.mockRestore();
  });
});
