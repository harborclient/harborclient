import { useEffect } from 'react';
import { startScriptLivePageBridge } from '#/renderer/src/scripting/scriptLivePageBridge';

/**
 * Mounts the script live page bridge so pre/post scripts can control browser tabs.
 */
export function ScriptLivePageHost(): null {
  /**
   * Subscribes to script live-page invocations for the lifetime of the renderer.
   *
   * Cleanup unsubscribes when the host unmounts so IPC handlers do not leak.
   */
  useEffect(() => {
    return startScriptLivePageBridge();
  }, []);

  return null;
}
