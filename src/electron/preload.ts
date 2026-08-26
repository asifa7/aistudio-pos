import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /**
   * Safe IPC invocation channel (Permissions enforced at IPC boundary in main.ts)
   */
  invoke: async (channel: string, ...args: any[]): Promise<any> => {
    return ipcRenderer.invoke(channel, ...args);
  }
});
