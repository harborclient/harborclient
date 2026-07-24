import { describe, expect, it } from 'vitest';
import { compareVersions, isNewerVersion, normalizeVersion } from './versionCompare';

describe('normalizeVersion', () => {
  it('strips a leading v prefix', () => {
    expect(normalizeVersion('v1.5.4')).toBe('1.5.4');
    expect(normalizeVersion('V2.0.0')).toBe('2.0.0');
  });

  it('returns trimmed versions unchanged when no prefix is present', () => {
    expect(normalizeVersion(' 1.4.3 ')).toBe('1.4.3');
  });
});

describe('compareVersions', () => {
  it('returns zero for equal versions', () => {
    expect(compareVersions('1.5.4', '1.5.4')).toBe(0);
    expect(compareVersions('v1.5.4', '1.5.4')).toBe(0);
  });

  it('returns positive when the left version is newer', () => {
    expect(compareVersions('1.5.4', '1.5.3')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.5.10', '1.5.9')).toBeGreaterThan(0);
  });

  it('returns negative when the left version is older', () => {
    expect(compareVersions('1.5.3', '1.5.4')).toBeLessThan(0);
    expect(compareVersions('1.4.9', '1.5.0')).toBeLessThan(0);
  });
});

describe('isNewerVersion', () => {
  it('returns true when the latest release is newer', () => {
    expect(isNewerVersion('v1.5.4', '1.5.3')).toBe(true);
  });

  it('returns false when versions match or the current version is newer', () => {
    expect(isNewerVersion('1.5.4', '1.5.4')).toBe(false);
    expect(isNewerVersion('1.5.3', '1.5.4')).toBe(false);
  });
});
