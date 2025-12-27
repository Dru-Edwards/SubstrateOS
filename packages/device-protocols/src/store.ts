/**
 * /dev/store0 - Persistent Key-Value Storage Device
 * 
 * Provides simple persistent storage capabilities to guest VMs using
 * browser storage APIs (localStorage for simplicity, IndexedDB for scale).
 */

import { DruOSDevice, DruOSDeviceContext } from './index.js';

export interface StoreRequest {
  id: string | number;
  op: 'PUT' | 'GET' | 'LIST' | 'DELETE' | 'CLEAR';
  key?: string;
  value?: string | null;
  prefix?: string;  // For LIST operation
}

export interface StoreResponse {
  id: string | number;
  ok: boolean;
  op: 'PUT' | 'GET' | 'LIST' | 'DELETE' | 'CLEAR';
  key?: string;
  value?: string | null;
  keys?: string[];
  error?: string;
}

/**
 * Simple in-memory storage backend for testing
 */
class MemoryStorageBackend {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    if (prefix) {
      return keys.filter(k => k.startsWith(prefix));
    }
    return keys;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Browser localStorage backend
 */
class LocalStorageBackend {
  private prefix: string;

  constructor(prefix: string = 'druos:store0:') {
    this.prefix = prefix;
  }

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.getFullKey(key));
    } catch (err) {
      console.error('localStorage.get error:', err);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.getFullKey(key), value);
    } catch (err) {
      console.error('localStorage.put error:', err);
      throw new Error('Storage quota exceeded or access denied');
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const existed = localStorage.getItem(fullKey) !== null;
      localStorage.removeItem(fullKey);
      return existed;
    } catch (err) {
      console.error('localStorage.delete error:', err);
      return false;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    const searchPrefix = this.prefix + (prefix || '');
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(searchPrefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    
    return keys;
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * Store device implementation
 */
export class StoreDevice implements DruOSDevice {
  name = '/dev/store0';
  private backend: MemoryStorageBackend | LocalStorageBackend;
  private context?: DruOSDeviceContext;

  constructor(options?: { useLocalStorage?: boolean; prefix?: string }) {
    // Use localStorage in browser, memory storage in Node/tests
    if (options?.useLocalStorage && typeof localStorage !== 'undefined') {
      this.backend = new LocalStorageBackend(options.prefix);
    } else {
      this.backend = new MemoryStorageBackend();
    }
  }

  async init(context: DruOSDeviceContext): Promise<void> {
    this.context = context;
    console.log(`[${this.name}] Storage device initialized`);
  }

  async read(offset: number, length: number): Promise<ArrayBuffer> {
    // Not used for this device - all operations go through write
    return new ArrayBuffer(0);
  }

  async write(data: ArrayBuffer): Promise<number> {
    try {
      // Decode the request
      const decoder = new TextDecoder();
      const requestStr = decoder.decode(data);
      const request: StoreRequest = JSON.parse(requestStr);

      // Process the operation
      let response: StoreResponse;

      switch (request.op) {
        case 'PUT':
          if (!request.key) {
            response = {
              id: request.id,
              ok: false,
              op: 'PUT',
              error: 'Missing key'
            };
          } else if (request.value === null || request.value === undefined) {
            response = {
              id: request.id,
              ok: false,
              op: 'PUT',
              error: 'Missing value'
            };
          } else {
            await this.backend.put(request.key, request.value);
            response = {
              id: request.id,
              ok: true,
              op: 'PUT',
              key: request.key
            };
          }
          break;

        case 'GET':
          if (!request.key) {
            response = {
              id: request.id,
              ok: false,
              op: 'GET',
              error: 'Missing key'
            };
          } else {
            const value = await this.backend.get(request.key);
            response = {
              id: request.id,
              ok: value !== null,
              op: 'GET',
              key: request.key,
              value: value
            };
          }
          break;

        case 'LIST':
          const keys = await this.backend.list(request.prefix);
          response = {
            id: request.id,
            ok: true,
            op: 'LIST',
            keys: keys
          };
          break;

        case 'DELETE':
          if (!request.key) {
            response = {
              id: request.id,
              ok: false,
              op: 'DELETE',
              error: 'Missing key'
            };
          } else {
            const deleted = await this.backend.delete(request.key);
            response = {
              id: request.id,
              ok: deleted,
              op: 'DELETE',
              key: request.key
            };
          }
          break;

        case 'CLEAR':
          await this.backend.clear();
          response = {
            id: request.id,
            ok: true,
            op: 'CLEAR'
          };
          break;

        default:
          response = {
            id: request.id,
            ok: false,
            op: request.op,
            error: `Unknown operation: ${request.op}`
          };
      }

      // Send response back
      const encoder = new TextEncoder();
      const responseBuffer = encoder.encode(JSON.stringify(response));
      
      if (this.context) {
        // Send response through a callback or event
        this.context.sendToGuest?.(responseBuffer);
      }

      return data.byteLength;
    } catch (err) {
      console.error(`[${this.name}] Error processing request:`, err);
      
      // Send error response
      const errorResponse: StoreResponse = {
        id: 0,
        ok: false,
        op: 'GET',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
      
      const encoder = new TextEncoder();
      const responseBuffer = encoder.encode(JSON.stringify(errorResponse));
      
      if (this.context) {
        this.context.sendToGuest?.(responseBuffer);
      }
      
      return 0;
    }
  }

  async ioctl(request: number, arg: ArrayBuffer): Promise<ArrayBuffer> {
    // Not used for this device
    return new ArrayBuffer(0);
  }

  async destroy(): Promise<void> {
    console.log(`[${this.name}] Storage device destroyed`);
  }

  async handleMessage(message: ArrayBuffer): Promise<void> {
    // Handle async messages if needed
    await this.write(message);
  }
}

/**
 * Factory function for creating store device
 */
export function createStoreDevice(options?: { 
  useLocalStorage?: boolean; 
  prefix?: string 
}): StoreDevice {
  return new StoreDevice(options);
}

/**
 * Guest-side C interface documentation
 * 
 * Example guest code for using /dev/store0:
 * 
 * ```c
 * #include <fcntl.h>
 * #include <unistd.h>
 * #include <string.h>
 * #include <stdio.h>
 * 
 * // Simple key-value store operations
 * int kv_put(const char* key, const char* value) {
 *     int fd = open("/dev/store0", O_WRONLY);
 *     if (fd < 0) return -1;
 *     
 *     char buffer[1024];
 *     snprintf(buffer, sizeof(buffer), 
 *              "{\"id\":1,\"op\":\"PUT\",\"key\":\"%s\",\"value\":\"%s\"}", 
 *              key, value);
 *     
 *     write(fd, buffer, strlen(buffer));
 *     close(fd);
 *     return 0;
 * }
 * 
 * int kv_get(const char* key, char* value, size_t len) {
 *     int fd = open("/dev/store0", O_RDWR);
 *     if (fd < 0) return -1;
 *     
 *     char buffer[1024];
 *     snprintf(buffer, sizeof(buffer), 
 *              "{\"id\":2,\"op\":\"GET\",\"key\":\"%s\"}", key);
 *     
 *     write(fd, buffer, strlen(buffer));
 *     
 *     // Read response
 *     ssize_t n = read(fd, buffer, sizeof(buffer)-1);
 *     if (n > 0) {
 *         buffer[n] = '\0';
 *         // Parse JSON response to extract value
 *         // ... JSON parsing code here ...
 *     }
 *     
 *     close(fd);
 *     return 0;
 * }
 * ```
 */
