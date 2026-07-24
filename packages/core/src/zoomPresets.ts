/** Default zoom factor for the main renderer (100%). */
export const DEFAULT_ZOOM_FACTOR = 1;

/** Zoom step applied by View menu and keyboard shortcuts. */
export const ZOOM_STEP = 0.1;

/** Minimum zoom factor allowed for the main renderer. */
export const MIN_ZOOM_FACTOR = 0.3;

/** Maximum zoom factor allowed for the main renderer. */
export const MAX_ZOOM_FACTOR = 5;

/**
 * First-run display size preset expressed as a step offset from the default zoom.
 */
export type ZoomPreset = '-1' | '1' | '+1';

/**
 * Selectable display size options shown in the first-run theme picker.
 */
export const ZOOM_PRESET_OPTIONS: ReadonlyArray<{ value: ZoomPreset; label: string }> = [
  { value: '-1', label: 'Small' },
  { value: '1', label: 'Medium' },
  { value: '+1', label: 'Large' }
];

/**
 * Rounds a zoom factor to one decimal place for stable menu stepping.
 *
 * @param factor - Raw zoom factor value.
 */
export function roundZoomFactor(factor: number): number {
  return Math.round(factor * 10) / 10;
}

/**
 * Clamps and rounds a zoom factor to supported bounds.
 *
 * @param factor - Raw zoom factor value.
 */
function normalizeZoomFactor(factor: number): number {
  const rounded = roundZoomFactor(factor);
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, rounded));
}

/**
 * Maps a first-run display size preset to its zoom factor.
 *
 * @param preset - Step offset from the default zoom factor.
 */
export function zoomPresetToFactor(preset: ZoomPreset): number {
  switch (preset) {
    case '-1':
      return normalizeZoomFactor(DEFAULT_ZOOM_FACTOR - ZOOM_STEP);
    case '+1':
      return normalizeZoomFactor(DEFAULT_ZOOM_FACTOR + ZOOM_STEP);
    case '1':
    default:
      return DEFAULT_ZOOM_FACTOR;
  }
}

/**
 * Maps a zoom factor back to the closest first-run display size preset.
 *
 * @param factor - Current zoom factor.
 */
export function zoomFactorToPreset(factor: number): ZoomPreset {
  const normalized = normalizeZoomFactor(factor);
  const small = zoomPresetToFactor('-1');
  const large = zoomPresetToFactor('+1');

  if (normalized <= small) {
    return '-1';
  }
  if (normalized >= large) {
    return '+1';
  }
  return '1';
}
