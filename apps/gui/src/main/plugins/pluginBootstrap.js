import { bootstrapViewHost } from 'harbor-plugin://host/view-host.js';

/**
 * Boots the isolated plugin webview after the shell document loads.
 *
 * Kept in an external module so the shell CSP can stay strict (no inline scripts).
 */
try {
  await bootstrapViewHost();
} catch (error) {
  const pluginId = new URL(globalThis.location.href).hostname;
  const message = error instanceof Error ? error.message : String(error);
  console.error('[HarborClient plugin shell]', message);
  await fetch(`harbor-plugin://${pluginId}/agent-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: message
  }).catch(() => {});
  throw error;
}
