/** @type {Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>} */
const pendingRequests = new Map();

/** @type {Map<string, Set<(payload: unknown) => void>>} */
const eventListeners = new Map();

/**
 * Returns the preload-provided bridge or throws when the plugin preload is missing.
 *
 * @returns {import('./hcBridge.d.ts').HcBridgeGlobal}
 */
export function requireHcBridge() {
  const bridge = globalThis.hcBridge;
  if (bridge == null) {
    throw new Error('Plugin hcBridge is not available. Is the plugin preload loaded?');
  }
  return bridge;
}

/**
 * Invokes a permission-checked host operation through the main-process broker.
 *
 * @param {string} op - Broker operation name.
 * @param {unknown} [payload] - Serializable operation payload.
 * @returns {Promise<unknown>}
 */
export async function bridgeInvoke(op, payload) {
  return requireHcBridge().invoke(op, payload);
}

/**
 * Subscribes to broker push events (theme changes, tab context updates, etc.).
 *
 * @param {string} channel - Event channel name.
 * @param {(payload: unknown) => void} listener - Event handler.
 * @returns {() => void} Unsubscribe function.
 */
export function bridgeOn(channel, listener) {
  const bridge = requireHcBridge();
  return bridge.on(channel, listener);
}

/**
 * Handles correlated replies from the main-process broker.
 *
 * @param {{ id: number; ok: boolean; result?: unknown; error?: string }} message - Broker reply.
 */
export function handleBridgeReply(message) {
  const pending = pendingRequests.get(message.id);
  if (!pending) {
    return;
  }
  pendingRequests.delete(message.id);
  if (message.ok) {
    pending.resolve(message.result);
    return;
  }
  pending.reject(new Error(message.error ?? 'Plugin bridge invocation failed.'));
}

/**
 * Dispatches a broker push event to registered listeners.
 *
 * @param {string} channel - Event channel name.
 * @param {unknown} payload - Event payload.
 */
export function dispatchBridgeEvent(channel, payload) {
  const listeners = eventListeners.get(channel);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(payload);
  }
}

/** Guards repeated bootstrap calls without mutating the frozen bridge object. */
let handlersInstalled = false;

/**
 * Prepares the bridge for use inside a plugin webview.
 *
 * The HarborClient plugin preload exposes a high-level bridge: `invoke` is
 * promise-based and `on(channel, listener)` dispatches host push events by
 * channel. `bridgeInvoke` and `bridgeOn` delegate straight to those methods,
 * so no reply/event correlation layer is needed here.
 *
 * The bridge is exposed through Electron `contextBridge`, which makes it
 * non-extensible with read-only properties. We therefore must not assign to it
 * (for example `bridge.__handlersInstalled` or reassigning `bridge.on`); doing
 * so throws "object is not extensible". Idempotency is tracked module-side.
 *
 * Called once from the view host bootstrap before plugin activation.
 */
export function installBridgeHandlers() {
  if (handlersInstalled) {
    return;
  }
  requireHcBridge();
  handlersInstalled = true;
}
