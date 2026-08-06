/// <reference types="vite/client" />

declare global {
  interface Window {
    threadflow?: { savePdf: () => Promise<{ saved: boolean; filePath?: string }> };
  }
}

export {};
