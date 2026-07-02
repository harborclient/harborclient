import type { WebContents } from 'electron';

/** Minimum zoom factor allowed for the main renderer. */
export const MIN_ZOOM_FACTOR = 0.3;

/** Maximum zoom factor allowed for the main renderer. */
export const MAX_ZOOM_FACTOR = 5;

/** Default zoom factor for the main renderer (100%). */
export const DEFAULT_ZOOM_FACTOR = 1;

/** Zoom step applied by View menu and keyboard shortcuts. */
export const ZOOM_STEP = 0.1;

/**
 * Rounds a zoom factor to one decimal place for stable menu stepping.
 *
 * @param factor - Raw zoom factor value.
 */
export function roundZoomFactor(factor: number): number {
  return Math.round(factor * 10) / 10;
}

/**
 * Increases the main window zoom factor by one step.
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function stepZoomIn(webContents: WebContents): void {
  const next = roundZoomFactor(webContents.zoomFactor + ZOOM_STEP);
  webContents.zoomFactor = Math.min(next, MAX_ZOOM_FACTOR);
}

/**
 * Decreases the main window zoom factor by one step.
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function stepZoomOut(webContents: WebContents): void {
  const next = roundZoomFactor(webContents.zoomFactor - ZOOM_STEP);
  webContents.zoomFactor = Math.max(next, MIN_ZOOM_FACTOR);
}

/**
 * Restores the main window zoom factor to the system default (100%).
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function resetZoom(webContents: WebContents): void {
  webContents.zoomFactor = DEFAULT_ZOOM_FACTOR;
}
