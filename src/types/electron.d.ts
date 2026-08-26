export interface ElectronApi {
  invoke(channel: string, ...args: any[]): Promise<any>;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
