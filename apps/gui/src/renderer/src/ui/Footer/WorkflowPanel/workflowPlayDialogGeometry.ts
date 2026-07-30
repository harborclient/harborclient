import { FLOATING_DIALOG_VIEWPORT_MARGIN_PX } from '@harborclient/sdk/components';

/**
 * localStorage key for the last Workflow play dialog geometry.
 */
export const WORKFLOW_PLAY_DIALOG_GEOMETRY_KEY = 'harborclient.workflowPlayDialog.geometry';

/**
 * Default height for a freshly opened play timeline dialog.
 */
export const DEFAULT_WORKFLOW_PLAY_DIALOG_HEIGHT_PX = 280;

/**
 * Absolute floor for play dialog width while resizing.
 */
export const WORKFLOW_PLAY_DIALOG_ABSOLUTE_MIN_WIDTH_PX = 800;

/**
 * Absolute floor for play dialog height while resizing.
 */
export const WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX = 160;

/**
 * Saved position and size for the Workflow play dialog.
 */
export interface WorkflowPlayDialogGeometry {
  /**
   * CSS `left` in viewport pixels.
   */
  left: number;

  /**
   * CSS `top` in viewport pixels.
   */
  top: number;

  /**
   * Panel width in pixels.
   */
  width: number;

  /**
   * Panel height in pixels.
   */
  height: number;
}

/**
 * Default play dialog width as a fraction of the viewport (`60vw`).
 */
export const DEFAULT_WORKFLOW_PLAY_DIALOG_WIDTH_VW = 0.6;

/**
 * Computes the default play dialog geometry for the current viewport.
 *
 * Opens at {@link DEFAULT_WORKFLOW_PLAY_DIALOG_WIDTH_VW} of the viewport width
 * (floored by {@link WORKFLOW_PLAY_DIALOG_ABSOLUTE_MIN_WIDTH_PX}), centered
 * horizontally and anchored near the bottom.
 *
 * @param viewportWidth - Optional viewport width (defaults to `window.innerWidth`).
 * @param viewportHeight - Optional viewport height (defaults to `window.innerHeight`).
 * @returns Initial position and size.
 */
export function defaultWorkflowPlayDialogGeometry(
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
): WorkflowPlayDialogGeometry {
  const margin = FLOATING_DIALOG_VIEWPORT_MARGIN_PX;
  const maxWidth = Math.max(WORKFLOW_PLAY_DIALOG_ABSOLUTE_MIN_WIDTH_PX, viewportWidth - margin * 2);
  const width = Math.min(
    maxWidth,
    Math.max(
      WORKFLOW_PLAY_DIALOG_ABSOLUTE_MIN_WIDTH_PX,
      Math.round(viewportWidth * DEFAULT_WORKFLOW_PLAY_DIALOG_WIDTH_VW)
    )
  );
  const height = Math.min(
    DEFAULT_WORKFLOW_PLAY_DIALOG_HEIGHT_PX,
    Math.max(WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX, viewportHeight - margin * 2)
  );
  return {
    left: Math.max(margin, Math.round((viewportWidth - width) / 2)),
    top: Math.max(margin, viewportHeight - height - margin),
    width,
    height
  };
}

/**
 * Minimum width allowed while resizing, based on the dialog's opening width.
 *
 * @param initialWidth - Width when the dialog was opened (or last fitted).
 * @returns `max(800, half of initialWidth)`.
 */
export function workflowPlayDialogMinWidth(initialWidth: number): number {
  return Math.max(WORKFLOW_PLAY_DIALOG_ABSOLUTE_MIN_WIDTH_PX, Math.round(initialWidth * 0.5));
}

/**
 * Reads the last saved Workflow play dialog geometry from localStorage.
 *
 * @returns Parsed geometry, or `null` when missing or invalid.
 */
export function loadWorkflowPlayDialogGeometry(): WorkflowPlayDialogGeometry | null {
  try {
    const raw = localStorage.getItem(WORKFLOW_PLAY_DIALOG_GEOMETRY_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<WorkflowPlayDialogGeometry>;
    if (
      typeof parsed.left !== 'number' ||
      typeof parsed.top !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      !Number.isFinite(parsed.left) ||
      !Number.isFinite(parsed.top) ||
      !Number.isFinite(parsed.width) ||
      !Number.isFinite(parsed.height)
    ) {
      return null;
    }
    return {
      left: parsed.left,
      top: parsed.top,
      width: parsed.width,
      height: parsed.height
    };
  } catch {
    return null;
  }
}

/**
 * Persists the Workflow play dialog geometry to localStorage.
 *
 * @param geometry - Position and size to store.
 */
export function saveWorkflowPlayDialogGeometry(geometry: WorkflowPlayDialogGeometry): void {
  if (
    !Number.isFinite(geometry.left) ||
    !Number.isFinite(geometry.top) ||
    !Number.isFinite(geometry.width) ||
    !Number.isFinite(geometry.height)
  ) {
    return;
  }
  try {
    localStorage.setItem(WORKFLOW_PLAY_DIALOG_GEOMETRY_KEY, JSON.stringify(geometry));
  } catch {
    // Ignore quota / private-mode failures.
  }
}
