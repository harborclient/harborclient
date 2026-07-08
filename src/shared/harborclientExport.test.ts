import { describe, expect, it } from 'vitest';
import {
  HARBORCLIENT_EXPORT_KINDS,
  isHarborclientExportKind,
  readHarborclientExport
} from '#/shared/harborclientExport';

describe('isHarborclientExportKind', () => {
  it('recognizes all supported export kinds', () => {
    for (const kind of HARBORCLIENT_EXPORT_KINDS) {
      expect(isHarborclientExportKind(kind)).toBe(true);
    }
  });

  it('rejects unknown export kinds', () => {
    expect(isHarborclientExportKind('plugin')).toBe(false);
    expect(isHarborclientExportKind('')).toBe(false);
  });
});

describe('readHarborclientExport', () => {
  it('returns the export kind from a valid payload', () => {
    expect(readHarborclientExport({ harborclientExport: 'snippet' })).toBe('snippet');
    expect(readHarborclientExport({ harborclientExport: 'theme' })).toBe('theme');
    expect(readHarborclientExport({ harborclientExport: 'collection-run-results' })).toBe(
      'collection-run-results'
    );
  });

  it('returns null for missing, non-string, or unknown discriminators', () => {
    expect(readHarborclientExport(null)).toBeNull();
    expect(readHarborclientExport({ harborclientExport: 1 })).toBeNull();
    expect(readHarborclientExport({ harborclientExport: 'unknown' })).toBeNull();
    expect(readHarborclientExport({})).toBeNull();
  });
});
