import type { PluginWebpageHandle } from '../types';

/**
 * Throws when a webpage bridge result is an `{ error }` object.
 *
 * @param result - Raw bridge result.
 * @returns The result when it is not an error.
 * @throws When the bridge returned `{ error: string }`.
 */
export function unwrapWebpageBridgeResult(result: unknown): unknown;

/**
 * Normalizes the optional second argument to `hc.webpage(url, options)`.
 *
 * @param options - User-provided options.
 * @returns Normalized open options.
 */
export function normalizeWebpageOpenOptions(options?: unknown): { reuse?: boolean };

/**
 * Builds a webpage handle whose methods call the host webpage bridge.
 *
 * @param tab - Opened tab metadata from the bridge.
 * @param callWebpage - Bridge transport.
 * @returns Plain-object handle for the plugin world.
 */
export function createWebpageHandle(
  tab: {
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  },
  callWebpage: (req: Record<string, unknown>) => Promise<unknown>
): PluginWebpageHandle;

/**
 * Opens or reuses an embedded browser tab and returns a control handle.
 *
 * @param callWebpage - Bridge transport that accepts ScriptWebpageRequest-shaped payloads.
 * @param url - Optional URL; omit to bind the active browser tab.
 * @param openOptions - Optional `{ reuse }` (default true).
 * @returns Webpage handle.
 */
export function openWebpage(
  callWebpage: (req: Record<string, unknown>) => Promise<unknown>,
  url?: unknown,
  openOptions?: unknown
): Promise<PluginWebpageHandle>;
