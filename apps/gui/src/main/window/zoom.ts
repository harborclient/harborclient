import type { WebContents } from 'electron';
import {
  DEFAULT_ZOOM_FACTOR,
  getPersistedZoomFactor,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  roundZoomFactor,
  setPersistedZoomFactor
} from '#/main/settings/zoomSettings';

export {
  DEFAULT_ZOOM_FACTOR,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  roundZoomFactor
} from '#/main/settings/zoomSettings';

/** Zoom step applied by View menu and keyboard shortcuts. */
export const ZOOM_STEP = 0.1;

/**
 * Normalizes a zoom factor to supported bounds and one-decimal precision.
 *
 * @param factor - Raw zoom factor value.
 */
function normalizeZoomFactor(factor: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, roundZoomFactor(factor)));
}

/**
 * Applies a zoom factor to the main renderer without persisting it.
 *
 * @param webContents - Main renderer web contents to scale.
 * @param factor - Target zoom factor.
 */
export function applyZoomFactorPreview(webContents: WebContents, factor: number): void {
  webContents.zoomFactor = normalizeZoomFactor(factor);
}

/**
 * Applies a zoom factor to the main renderer and persists it for the next launch.
 *
 * @param webContents - Main renderer web contents to scale.
 * @param factor - Target zoom factor.
 */
export function setZoomFactor(webContents: WebContents, factor: number): void {
  const normalized = normalizeZoomFactor(factor);
  webContents.zoomFactor = normalized;
  setPersistedZoomFactor(normalized);
}

/**
 * Applies a zoom factor to the main renderer and persists it for the next launch.
 *
 * @param webContents - Main renderer web contents to scale.
 * @param factor - Target zoom factor.
 */
function applyZoomFactor(webContents: WebContents, factor: number): void {
  setZoomFactor(webContents, factor);
}

/**
 * Restores the persisted main-window zoom factor.
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function restoreZoomFactor(webContents: WebContents): void {
  applyZoomFactor(webContents, getPersistedZoomFactor());
}

/**
 * Increases the main window zoom factor by one step.
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function stepZoomIn(webContents: WebContents): void {
  const next = roundZoomFactor(webContents.zoomFactor + ZOOM_STEP);
  applyZoomFactor(webContents, Math.min(next, MAX_ZOOM_FACTOR));
}

/**
 * Decreases the main window zoom factor by one step.
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function stepZoomOut(webContents: WebContents): void {
  const next = roundZoomFactor(webContents.zoomFactor - ZOOM_STEP);
  applyZoomFactor(webContents, Math.max(next, MIN_ZOOM_FACTOR));
}

/**
 * Restores the main window zoom factor to the system default (100%).
 *
 * @param webContents - Main renderer web contents to scale.
 */
export function resetZoom(webContents: WebContents): void {
  applyZoomFactor(webContents, DEFAULT_ZOOM_FACTOR);
}
