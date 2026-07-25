import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  byteLength,
  createLogger,
  randomId,
  truncateBody,
  truncateToBytes
} from './runtime-utils.js';

const originalTextEncoder = globalThis.TextEncoder;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

afterEach(() => {
  globalThis.TextEncoder = originalTextEncoder;
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  }
  vi.restoreAllMocks();
});

/**
 * Temporarily clears `globalThis.crypto` so fallback ID generation can be exercised.
 *
 * @returns {void}
 */
function clearCrypto() {
  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
    writable: true
  });
}

function withoutTextEncoder<T>(run: () => T): T {
  // @ts-expect-error — exercise manual UTF-8 fallback used in SES main runtime
  globalThis.TextEncoder = undefined;
  return run();
}

describe('randomId', () => {
  it('returns a UUID when crypto.randomUUID is available', () => {
    const spy = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000000');
    expect(randomId()).toBe('00000000-0000-4000-8000-000000000000');
    spy.mockRestore();
  });

  it('falls back to a prefixed id when randomUUID is unavailable', () => {
    clearCrypto();
    expect(randomId('req')).toMatch(/^req-\d+-[a-z0-9]+$/);
  });

  it('uses the default prefix in the fallback path', () => {
    clearCrypto();
    expect(randomId()).toMatch(/^id-\d+-[a-z0-9]+$/);
  });
});

describe('byteLength', () => {
  it('counts ASCII as one byte per character', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('')).toBe(0);
  });

  it('counts two-byte UTF-8 characters', () => {
    expect(byteLength('é')).toBe(2);
  });

  it('counts three-byte UTF-8 characters', () => {
    expect(byteLength('中')).toBe(3);
  });

  it('counts surrogate pairs as four bytes', () => {
    expect(byteLength('😀')).toBe(4);
  });

  it('matches TextEncoder when the manual fallback is used', () => {
    const samples = ['plain', 'é', '中', '😀', 'mix é 中 😀'];
    for (const sample of samples) {
      const encodedLength = new originalTextEncoder().encode(sample).length;
      withoutTextEncoder(() => {
        expect(byteLength(sample)).toBe(encodedLength);
      });
    }
  });
});

describe('truncateToBytes', () => {
  it('returns the original string when it fits', () => {
    expect(truncateToBytes('hello', 10)).toBe('hello');
    expect(truncateToBytes('é', 2)).toBe('é');
  });

  it('truncates multibyte text without splitting code units', () => {
    expect(truncateToBytes('éé', 2)).toBe('é');
    expect(truncateToBytes('abc', 2)).toBe('ab');
  });

  it('returns an empty string when maxBytes is zero', () => {
    expect(truncateToBytes('hello', 0)).toBe('');
  });

  it('excludes an incomplete surrogate pair in the manual fallback', () => {
    withoutTextEncoder(() => {
      expect(truncateToBytes('a😀b', 2)).toBe('a');
    });
  });

  it('does not split multibyte characters in the manual fallback', () => {
    withoutTextEncoder(() => {
      expect(truncateToBytes('mix é end', 5)).toBe('mix ');
      expect(truncateToBytes('中文字', 3)).toBe('中');
    });
  });
});

describe('truncateBody', () => {
  it('returns the body unchanged when within the byte limit', () => {
    expect(truncateBody('{"ok":true}', 100)).toEqual({
      body: '{"ok":true}',
      truncated: false
    });
  });

  it('truncates and appends the default suffix when over the limit', () => {
    const body = 'x'.repeat(20);
    const maxBytes = 10;
    const result = truncateBody(body, maxBytes);

    expect(result.truncated).toBe(true);
    expect(result.body.endsWith(`[truncated — body exceeded ${maxBytes} bytes]`)).toBe(true);
    expect(
      byteLength(result.body.replace(/\n\n\[truncated — body exceeded \d+ bytes\]$/, ''))
    ).toBeLessThanOrEqual(maxBytes);
  });

  it('uses a custom suffix when provided', () => {
    const result = truncateBody('0123456789', 5, '…');

    expect(result).toEqual({
      body: '01234…',
      truncated: true
    });
  });
});

describe('createLogger', () => {
  it('prefixes messages with [pluginId]', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('my-plugin');

    logger.info('hello');

    expect(logSpy).toHaveBeenCalledWith('[my-plugin]', 'hello');
    logSpy.mockRestore();
  });

  it('filters messages below the active level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('my-plugin', { level: 'warn' });

    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('visible');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[my-plugin]', 'visible');
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('updates the active level via setLevel', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('my-plugin');

    logger.info('before');
    logger.setLevel('silent');
    logger.info('after');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('[my-plugin]', 'before');
    logSpy.mockRestore();
  });

  it('suppresses all output at silent level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('my-plugin', { level: 'silent' });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('routes warn and error through console.warn and console.error when available', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('my-plugin', { level: 'debug' });

    logger.warn('warned');
    logger.error('failed');

    expect(warnSpy).toHaveBeenCalledWith('[my-plugin]', 'warned');
    expect(errorSpy).toHaveBeenCalledWith('[my-plugin]', 'failed');
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('falls back to console.log when console.warn and console.error are unavailable', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const originalWarn = console.warn;
    const originalError = console.error;
    // @ts-expect-error — exercise SES main-runtime fallback
    console.warn = undefined;
    // @ts-expect-error — exercise SES main-runtime fallback
    console.error = undefined;

    const logger = createLogger('my-plugin', { level: 'debug' });
    logger.warn('warned');
    logger.error('failed');

    expect(logSpy).toHaveBeenCalledWith('[my-plugin]', 'warned');
    expect(logSpy).toHaveBeenCalledWith('[my-plugin]', 'failed');

    console.warn = originalWarn;
    console.error = originalError;
    logSpy.mockRestore();
  });
});
