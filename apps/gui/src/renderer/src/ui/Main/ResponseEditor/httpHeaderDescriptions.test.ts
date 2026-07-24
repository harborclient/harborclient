import { describe, expect, it } from 'vitest';
import {
  getHttpHeaderDescription,
  HTTP_HEADER_DESCRIPTIONS,
  UNKNOWN_HEADER_DESCRIPTION
} from './httpHeaderDescriptions';

describe('getHttpHeaderDescription', () => {
  it('returns a description for a known header regardless of case', () => {
    expect(getHttpHeaderDescription('Content-Type')).toBe(HTTP_HEADER_DESCRIPTIONS['content-type']);
  });

  it('returns the fallback message for unknown headers', () => {
    expect(getHttpHeaderDescription('x-request-id')).toBe(UNKNOWN_HEADER_DESCRIPTION);
  });

  it('trims whitespace before lookup', () => {
    expect(getHttpHeaderDescription('  cache-control  ')).toBe(
      HTTP_HEADER_DESCRIPTIONS['cache-control']
    );
  });
});
