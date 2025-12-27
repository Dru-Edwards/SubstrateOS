// Common device abstractions
export interface DruOSDeviceContext {
  sendToGuest(data: ArrayBuffer | Uint8Array): void;
  runtime?: any; // Reference to runtime if needed
}

export interface DruOSDevice {
  name: string;
  init(context: DruOSDeviceContext): Promise<void> | void;
  handleMessage(data: ArrayBuffer | Uint8Array): Promise<void>;
}

// Export device implementations
export * from './http';
export * from './hostlog';
export * from './store';
export * from './ai';
export { httpDevice } from './http';
