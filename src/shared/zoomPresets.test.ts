import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM_FACTOR, zoomFactorToPreset, zoomPresetToFactor } from '#/shared/zoomPresets';

describe('zoomPresetToFactor', () => {
  it('maps Small to one step below the default zoom', () => {
    expect(zoomPresetToFactor('-1')).toBe(0.9);
  });

  it('maps Medium to the default zoom', () => {
    expect(zoomPresetToFactor('1')).toBe(DEFAULT_ZOOM_FACTOR);
  });

  it('maps Large to one step above the default zoom', () => {
    expect(zoomPresetToFactor('+1')).toBe(1.1);
  });
});

describe('zoomFactorToPreset', () => {
  it('maps known preset factors back to their preset ids', () => {
    expect(zoomFactorToPreset(0.9)).toBe('-1');
    expect(zoomFactorToPreset(1)).toBe('1');
    expect(zoomFactorToPreset(1.1)).toBe('+1');
  });

  it('snaps unknown zoom factors to the nearest preset', () => {
    expect(zoomFactorToPreset(0.85)).toBe('-1');
    expect(zoomFactorToPreset(1.04)).toBe('1');
    expect(zoomFactorToPreset(1.05)).toBe('+1');
    expect(zoomFactorToPreset(1.2)).toBe('+1');
  });
});
