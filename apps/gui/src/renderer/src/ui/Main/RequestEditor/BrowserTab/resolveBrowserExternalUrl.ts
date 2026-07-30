import { resolveBrowserAddressInput } from './resolveBrowserAddress';

/**
 * Protocols the OS default browser can open from the Live Page address bar.
 */
const EXTERNAL_BROWSER_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Resolves address-bar text to an absolute http(s) URL suitable for opening in
 * the OS default browser.
 *
 * Uses the same substitution and normalization as in-app navigation, then
 * rejects schemes that must stay in the guest (`about:blank`, `view-source:`)
 * or that main would block from `shell.openExternal`.
 *
 * @param input - Raw address-bar text, possibly containing `{{variables}}`.
 * @param runtimeVars - Runtime map from {@link buildRuntimeVars}.
 * @returns Absolute http(s) URL, or null when nothing safe can be opened.
 */
export function resolveBrowserExternalUrl(
  input: string,
  runtimeVars: Record<string, string>
): string | null {
  const resolved = resolveBrowserAddressInput(input, runtimeVars);
  if (!resolved) {
    return null;
  }

  try {
    const parsed = new URL(resolved);
    if (!EXTERNAL_BROWSER_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
