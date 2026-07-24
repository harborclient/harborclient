import { contextBridge, ipcRenderer } from 'electron';

/**
 * Parses plugin webview session metadata from preload launch arguments.
 */
function readSessionFromArgv(): {
  pluginId: string;
  role: 'agent' | 'view';
  contributionId?: string;
  kind?: string;
  slot?: string;
} {
  const pluginIdArg = process.argv.find((arg) => arg.startsWith('--plugin-id='));
  const roleArg = process.argv.find((arg) => arg.startsWith('--plugin-role='));
  const contribArg = process.argv.find((arg) => arg.startsWith('--plugin-contrib='));
  const kindArg = process.argv.find((arg) => arg.startsWith('--plugin-kind='));
  const slotArg = process.argv.find((arg) => arg.startsWith('--plugin-slot='));

  const pluginId = pluginIdArg?.slice('--plugin-id='.length);
  const roleValue = roleArg?.slice('--plugin-role='.length);
  if (!pluginId || (roleValue !== 'agent' && roleValue !== 'view')) {
    throw new Error('Plugin preload requires --plugin-id and --plugin-role arguments.');
  }

  return {
    pluginId,
    role: roleValue,
    contributionId: contribArg?.slice('--plugin-contrib='.length) || undefined,
    kind: kindArg?.slice('--plugin-kind='.length) || undefined,
    slot: slotArg?.slice('--plugin-slot='.length) || undefined
  };
}

const session = readSessionFromArgv();

ipcRenderer.send('plugins:uiRegisterSession', session);

/** @type {Map<string, Set<(payload: unknown) => void>>} */
const listeners = new Map();

/**
 * Dispatches a push event to listeners registered for one channel.
 *
 * @param channel - Event channel name.
 * @param payload - Serializable event payload.
 */
function dispatchEvent(channel: string, payload: unknown): void {
  const channelListeners = listeners.get(channel);
  if (!channelListeners) {
    return;
  }
  for (const listener of channelListeners) {
    listener(payload);
  }
}

ipcRenderer.on('plugin-ui:event', (_event, message: { channel: string; payload: unknown }) => {
  dispatchEvent(message.channel, message.payload);
  if (message.channel === 'theme.styles') {
    const payload = message.payload as { dataTheme?: string | null; cssText?: string };
    if (payload.dataTheme != null) {
      document.documentElement.setAttribute('data-theme', payload.dataTheme);
    }
    if (payload.cssText) {
      let style = document.getElementById('harbor-plugin-theme-vars');
      if (!style) {
        style = document.createElement('style');
        style.id = 'harbor-plugin-theme-vars';
        document.head.appendChild(style);
      }
      style.textContent = payload.cssText;
    }
  }
});

contextBridge.exposeInMainWorld('hcBridge', {
  /**
   * Invokes a permission-checked broker operation in the main process.
   *
   * @param op - Broker operation name.
   * @param payload - Serializable operation payload.
   */
  invoke(op: string, payload?: unknown): Promise<unknown> {
    return ipcRenderer.invoke('plugins:uiBridge', { op, payload });
  },

  /**
   * Subscribes to broker push events routed through the preload.
   *
   * @param channel - Event channel name.
   * @param listener - Event handler.
   */
  on(channel: string, listener: (payload: unknown) => void): () => void {
    const channelListeners = listeners.get(channel) ?? new Set();
    channelListeners.add(listener);
    listeners.set(channel, channelListeners);
    return () => {
      channelListeners.delete(listener);
    };
  }
});

contextBridge.exposeInMainWorld('__HARBORCLIENT_PLUGIN_SESSION__', session);
