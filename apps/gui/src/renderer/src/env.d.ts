/// <reference types="vite/client" />

declare global {
  interface Window {
    platform: NodeJS.Platform;
    operatingSystemInfo: import('@harborclient/core/types/app').OperatingSystemInfo;
  }
}

export {};
