/// <reference types="vite/client" />

declare global {
  interface Window {
    platform: NodeJS.Platform;
    operatingSystemInfo: import('#/shared/types/app').OperatingSystemInfo;
  }
}

export {};
