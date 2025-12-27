/**
 * HTTP Device Bridge - Unit Tests
 * Tests protocol compliance and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpDevice } from '../../src/devices/http';
import { DeviceRequest } from '../../src/devices/base';

describe('HTTP Device', () => {
  let device: HttpDevice;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    device = new HttpDevice({
      allowedDomains: ['*.example.com', 'api.test.com'],
      blockedDomains: ['evil.com'],
      timeout: 5000,
      maxSize: 1024 * 1024 // 1MB
    });

    // Mock fetch
    fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
  });

  describe('Protocol Compliance', () => {
    it('should handle valid GET request', async () => {
      const request: DeviceRequest = {
        id: 'req-1',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://api.example.com/data'
        }
      };

      const response = await device.handle(request);

      expect(response.type).toBe('response');
      expect(response.payload.status).toBe(200);
      expect(response.payload.body).toEqual({ success: true });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle POST with body', async () => {
      const request: DeviceRequest = {
        id: 'req-2',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: { 'Content-Type': 'application/json' },
          body: { name: 'John', age: 30 }
        }
      };

      await device.handle(request);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'John', age: 30 }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle binary data with base64', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const base64 = btoa(String.fromCharCode(...binaryData));

      const request: DeviceRequest = {
        id: 'req-3',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'POST',
          url: 'https://api.example.com/upload',
          body: { binary: base64 }
        }
      };

      await device.handle(request);

      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(Uint8Array);
    });
  });

  describe('Domain Validation', () => {
    it('should allow whitelisted domains', async () => {
      const request: DeviceRequest = {
        id: 'req-4',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://sub.example.com/api'
        }
      };

      await expect(device.handle(request)).resolves.not.toThrow();
    });

    it('should reject non-whitelisted domains', async () => {
      const request: DeviceRequest = {
        id: 'req-5',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://notallowed.com/api'
        }
      };

      await expect(device.handle(request)).rejects.toThrow('Domain not allowed');
    });

    it('should reject blacklisted domains', async () => {
      const request: DeviceRequest = {
        id: 'req-6',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://evil.com/steal'
        }
      };

      await expect(device.handle(request)).rejects.toThrow('Domain blocked');
    });
  });

  describe('Error Handling', () => {
    it('should handle network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const request: DeviceRequest = {
        id: 'req-7',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://api.example.com/data'
        }
      };

      await expect(device.handle(request)).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      fetchMock.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 100)
        )
      );

      const request: DeviceRequest = {
        id: 'req-8',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://api.example.com/slow',
          timeout: 50
        }
      };

      await expect(device.handle(request)).rejects.toThrow('timeout');
    });

    it('should reject oversized responses', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('x'.repeat(2 * 1024 * 1024), {
          headers: { 'content-length': String(2 * 1024 * 1024) }
        })
      );

      const request: DeviceRequest = {
        id: 'req-9',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://api.example.com/large'
        }
      };

      await expect(device.handle(request)).rejects.toThrow('Response too large');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const device = new HttpDevice({
        rateLimit: { requests: 2, window: 1000 } // 2 req/sec
      });

      const request: DeviceRequest = {
        id: 'req-10',
        deviceId: '/dev/http',
        operation: 'request',
        payload: {
          method: 'GET',
          url: 'https://api.example.com/data'
        }
      };

      // First two should succeed
      await device.handle(request);
      await device.handle(request);

      // Third should fail
      await expect(device.handle(request)).rejects.toThrow('Rate limit exceeded');
    });
  });
});

describe('Storage Device', () => {
  let device: StorageDevice;
  let mockDB: IDBDatabase;

  beforeEach(async () => {
    // Mock IndexedDB
    const mockStore = new Map<string, any>();
    
    mockDB = {
      transaction: (stores: string[], mode: string) => ({
        objectStore: (name: string) => ({
          get: (key: string) => ({
            onsuccess: null,
            onerror: null,
            result: mockStore.get(key)
          }),
          put: (value: any, key: string) => {
            mockStore.set(key, value);
            return { onsuccess: null, onerror: null };
          },
          delete: (key: string) => {
            mockStore.delete(key);
            return { onsuccess: null, onerror: null };
          }
        })
      })
    } as any;

    device = new StorageDevice({
      quota: 1024 * 1024, // 1MB
      persistent: true
    });
    
    // Inject mock DB
    device['db'] = mockDB;
  });

  it('should store and retrieve values', async () => {
    const setRequest: DeviceRequest = {
      id: 'req-1',
      deviceId: '/dev/store0',
      operation: 'set',
      payload: {
        key: 'test-key',
        value: 'test-value'
      }
    };

    await device.handle(setRequest);

    const getRequest: DeviceRequest = {
      id: 'req-2',
      deviceId: '/dev/store0',
      operation: 'get',
      payload: {
        key: 'test-key'
      }
    };

    const response = await device.handle(getRequest);
    expect(response.payload.value).toBe('test-value');
  });

  it('should handle quota exceeded', async () => {
    device['usage'] = 1024 * 1024; // At quota limit

    const request: DeviceRequest = {
      id: 'req-3',
      deviceId: '/dev/store0',
      operation: 'set',
      payload: {
        key: 'overflow',
        value: 'x'.repeat(1000)
      }
    };

    await expect(device.handle(request)).rejects.toThrow('quota exceeded');
  });

  it('should handle TTL expiration', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const setRequest: DeviceRequest = {
      id: 'req-4',
      deviceId: '/dev/store0',
      operation: 'set',
      payload: {
        key: 'ttl-key',
        value: 'expires',
        ttl: 1 // 1 second
      }
    };

    await device.handle(setRequest);

    // Advance time
    vi.spyOn(Date, 'now').mockReturnValue(now + 2000);

    const getRequest: DeviceRequest = {
      id: 'req-5',
      deviceId: '/dev/store0',
      operation: 'get',
      payload: {
        key: 'ttl-key'
      }
    };

    const response = await device.handle(getRequest);
    expect(response.payload.value).toBeNull(); // Expired
  });
});

describe('Logger Device', () => {
  let device: LoggerDevice;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    device = new LoggerDevice({
      level: 'info',
      format: 'json',
      buffer: 100
    });

    consoleSpy = vi.spyOn(console, 'log').mockImplementation();
  });

  it('should forward logs to console', async () => {
    const request: DeviceRequest = {
      id: 'req-1',
      deviceId: '/dev/hostlog',
      operation: 'log',
      payload: {
        level: 'info',
        msg: 'Test message',
        metadata: { component: 'test' }
      }
    };

    await device.handle(request);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[info]'),
      expect.stringContaining('Test message'),
      expect.objectContaining({ component: 'test' })
    );
  });

  it('should respect log level filtering', async () => {
    device = new LoggerDevice({ level: 'error' });

    const infoRequest: DeviceRequest = {
      id: 'req-2',
      deviceId: '/dev/hostlog',
      operation: 'log',
      payload: {
        level: 'info',
        msg: 'Should be filtered'
      }
    };

    const errorRequest: DeviceRequest = {
      id: 'req-3',
      deviceId: '/dev/hostlog',
      operation: 'log',
      payload: {
        level: 'error',
        msg: 'Should appear'
      }
    };

    await device.handle(infoRequest);
    await device.handle(errorRequest);

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Should be filtered')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Should appear')
    );
  });

  it('should maintain buffer', async () => {
    device = new LoggerDevice({ buffer: 3 });

    for (let i = 0; i < 5; i++) {
      await device.handle({
        id: `req-${i}`,
        deviceId: '/dev/hostlog',
        operation: 'log',
        payload: {
          level: 'info',
          msg: `Message ${i}`
        }
      });
    }

    const buffer = device.getBuffer();
    expect(buffer.length).toBe(3);
    expect(buffer[0].msg).toBe('Message 2'); // Oldest in buffer
    expect(buffer[2].msg).toBe('Message 4'); // Newest
  });
});
