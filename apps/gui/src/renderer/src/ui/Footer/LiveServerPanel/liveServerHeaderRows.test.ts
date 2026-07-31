import { describe, expect, it } from 'vitest';
import {
  filterLiveServerHeadersForSave,
  keyValueRowsToLiveServerHeaders,
  liveServerHeadersToKeyValueRows
} from './liveServerHeaderRows';

describe('liveServerHeadersToKeyValueRows', () => {
  it('maps name to key and appends a trailing empty row', () => {
    expect(
      liveServerHeadersToKeyValueRows([{ name: 'Cache-Control', value: 'no-store', enabled: true }])
    ).toEqual([
      { key: 'Cache-Control', value: 'no-store', enabled: true },
      { key: '', value: '', enabled: true }
    ]);
  });

  it('returns a single empty row when headers are empty', () => {
    expect(liveServerHeadersToKeyValueRows([])).toEqual([{ key: '', value: '', enabled: true }]);
  });

  it('does not double-append when the last row is already blank', () => {
    expect(liveServerHeadersToKeyValueRows([{ name: '', value: '', enabled: true }])).toEqual([
      { key: '', value: '', enabled: true }
    ]);
  });
});

describe('keyValueRowsToLiveServerHeaders', () => {
  it('maps key to name', () => {
    expect(
      keyValueRowsToLiveServerHeaders([
        { key: 'X-Frame-Options', value: 'DENY', enabled: false },
        { key: '', value: '', enabled: true }
      ])
    ).toEqual([
      { name: 'X-Frame-Options', value: 'DENY', enabled: false },
      { name: '', value: '', enabled: true }
    ]);
  });
});

describe('filterLiveServerHeadersForSave', () => {
  it('drops empty names and trims remaining names', () => {
    expect(
      filterLiveServerHeadersForSave([
        { name: '  Cache-Control  ', value: 'no-store', enabled: true },
        { name: '', value: 'ignored', enabled: true },
        { name: '   ', value: 'also-ignored', enabled: true },
        { name: 'X-Test', value: '1', enabled: false }
      ])
    ).toEqual([
      { name: 'Cache-Control', value: 'no-store', enabled: true },
      { name: 'X-Test', value: '1', enabled: false }
    ]);
  });

  it('allows an empty list', () => {
    expect(filterLiveServerHeadersForSave([])).toEqual([]);
  });
});
