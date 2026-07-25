/**
 * Preload bridge exposed to isolated plugin webContents.
 */
export interface HcBridgeGlobal {
  /**
   * Invokes a permission-checked broker operation in the main process.
   */
  invoke(op: string, payload?: unknown): Promise<unknown>;

  /**
   * Subscribes to preload push events from the main process.
   */
  on(channel: string, listener: (payload: unknown) => void): () => void;

  /** @internal Prevents duplicate handler installation. */
  __handlersInstalled?: boolean;
}

declare global {
  /**
   * Scoped plugin bridge installed by the HarborClient plugin preload.
   */
  var hcBridge: HcBridgeGlobal | undefined;
}

export {};
