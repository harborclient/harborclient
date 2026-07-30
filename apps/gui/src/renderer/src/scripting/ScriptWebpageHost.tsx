import { useEffect } from 'react';
import { startScriptWebpageBridge } from '#/renderer/src/scripting/scriptWebpageBridge';

/**
 * Mounts the script webpage bridge so pre/post scripts can control browser tabs.
 */
export function ScriptWebpageHost(): null {
  /**
   * Subscribes to script webpage invocations for the lifetime of the renderer.
   */
  useEffect(() => {
    return startScriptWebpageBridge();
  }, []);

  return null;
}
