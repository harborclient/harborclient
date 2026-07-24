import type { Api } from './api';

declare global {
  /**
   * Extends Window with the preload-exposed API.
   */
  interface Window {
    /**
     * IPC bridge for collections, saved requests, and HTTP execution.
     */
    api: Api;
  }
}

export {};
