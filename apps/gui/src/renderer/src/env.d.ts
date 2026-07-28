/// <reference types="vite/client" />

declare global {
  interface Window {
    platform: NodeJS.Platform;
    operatingSystemInfo: import('@harborclient/core/types/app').OperatingSystemInfo;
    /**
     * In-memory workflow activity log for renderer console inspection.
     * Populated by {@link import('./workflows/workflowRecorder').installWorkflowLogGlobal}.
     */
    __workflowLog?: import('./workflows/workflowRecorder').WorkflowLogApi;
  }
}

export {};
