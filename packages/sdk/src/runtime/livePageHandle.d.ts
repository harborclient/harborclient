import type { PluginLivePageHandle } from '../types';

/**
 * Throws when a live-page bridge result is an `{ error }` object.
 *
 * @param result - Raw bridge result.
 * @returns The result when it is not an error.
 * @throws When the bridge returned `{ error: string }`.
 */
export function unwrapLivePageBridgeResult(result: unknown): unknown;

/**
 * Normalizes the optional second argument to `hc.livePage(url, options)`.
 *
 * @param options - User-provided options.
 * @returns Normalized open options.
 */
export function normalizeLivePageOpenOptions(options?: unknown): { reuse?: boolean };

/**
 * Builds a live-page handle whose methods call the host live-page bridge.
 *
 * @param tab - Opened tab metadata from the bridge.
 * @param callLivePage - Bridge transport.
 * @returns Plain-object handle for the plugin world.
 */
export function createLivePageHandle(
  tab: {
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  },
  callLivePage: (req: Record<string, unknown>) => Promise<unknown>
): PluginLivePageHandle;

/**
 * Opens or reuses an embedded browser tab and returns a control handle.
 *
 * @param callLivePage - Bridge transport that accepts ScriptLivePageRequest-shaped payloads.
 * @param url - Optional URL; omit to bind the active browser tab.
 * @param openOptions - Optional `{ reuse }` (default true).
 * @returns Live-page handle.
 */
export function openLivePage(
  callLivePage: (req: Record<string, unknown>) => Promise<unknown>,
  url?: unknown,
  openOptions?: unknown
): Promise<PluginLivePageHandle>;
