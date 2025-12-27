import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hostLogDevice } from '../src/hostlog';
import type { DruOSDeviceContext } from '../src/index';

describe('HostLog Device', () => {
  let device: any;
  let context: DruOSDeviceContext;
  let logSpy: any;
  let sentToGuest: Uint8Array | null;
  
  beforeEach(() => {
    sentToGuest = null;
    
    // Create mock context
    context = {
      sendToGuest: (data: ArrayBuffer | Uint8Array) => {
        sentToGuest = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      }
    };
    
    // Create device with spy
    logSpy = vi.fn();
    device = hostLogDevice({
      onLog: logSpy
    });
    
    // Initialize device
    device.init(context);
  });
  
  describe('Message Handling', () => {
    it('should parse and forward valid log messages', async () => {
      const logEntry = {
        level: 'info',
        category: 'test',
        message: 'Test message',
        metadata: { foo: 'bar' }
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(logEntry));
      
      await device.handleMessage(data);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          category: 'test',
          message: 'Test message',
          metadata: { foo: 'bar' },
          timestamp: expect.any(Number)
        })
      );
    });
    
    it('should add timestamp if not present', async () => {
      const logEntry = {
        level: 'debug',
        category: 'test',
        message: 'No timestamp'
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(logEntry));
      
      await device.handleMessage(data);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      );
    });
    
    it('should send acknowledgment to guest', async () => {
      const logEntry = {
        id: 'log-123',
        level: 'info',
        category: 'test',
        message: 'Test'
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(logEntry));
      
      await device.handleMessage(data);
      
      expect(sentToGuest).toBeDefined();
      
      const decoder = new TextDecoder();
      const response = JSON.parse(decoder.decode(sentToGuest!));
      
      expect(response).toEqual({
        type: 'ack',
        id: 'log-123'
      });
    });
    
    it('should handle invalid JSON gracefully', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('invalid json {');
      
      // Mock console.error to avoid test noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await device.handleMessage(data);
      
      expect(logSpy).not.toHaveBeenCalled();
      expect(sentToGuest).toBeDefined();
      
      const decoder = new TextDecoder();
      const response = JSON.parse(decoder.decode(sentToGuest!));
      
      expect(response).toEqual({
        type: 'error',
        error: 'Invalid log message format'
      });
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Buffer Management', () => {
    it('should maintain log buffer', async () => {
      const entries = [
        { level: 'info', category: 'test', message: 'Message 1' },
        { level: 'debug', category: 'test', message: 'Message 2' },
        { level: 'warn', category: 'test', message: 'Message 3' }
      ];
      
      const encoder = new TextEncoder();
      
      for (const entry of entries) {
        await device.handleMessage(encoder.encode(JSON.stringify(entry)));
      }
      
      const buffer = device.getBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toBe('Message 1');
      expect(buffer[2].message).toBe('Message 3');
    });
    
    it('should respect buffer size limit', async () => {
      // Create device with small buffer
      device = hostLogDevice({
        bufferSize: 2
      });
      device.init(context);
      
      const encoder = new TextEncoder();
      
      for (let i = 0; i < 5; i++) {
        await device.handleMessage(encoder.encode(JSON.stringify({
          level: 'info',
          category: 'test',
          message: `Message ${i}`
        })));
      }
      
      const buffer = device.getBuffer();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].message).toBe('Message 3');
      expect(buffer[1].message).toBe('Message 4');
    });
    
    it('should clear buffer when requested', async () => {
      const encoder = new TextEncoder();
      
      await device.handleMessage(encoder.encode(JSON.stringify({
        level: 'info',
        category: 'test',
        message: 'Test'
      })));
      
      expect(device.getBuffer()).toHaveLength(1);
      
      device.clearBuffer();
      
      expect(device.getBuffer()).toHaveLength(0);
    });
  });
  
  describe('Default Console Logging', () => {
    it('should log to console when no handler provided', async () => {
      // Create device without handler
      device = hostLogDevice();
      device.init(context);
      
      const consoleSpy = {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {})
      };
      
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      const encoder = new TextEncoder();
      
      for (const level of levels) {
        await device.handleMessage(encoder.encode(JSON.stringify({
          level,
          category: 'test',
          message: `${level} message`
        })));
      }
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('debug message'),
        ''
      );
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('info message'),
        ''
      );
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.stringContaining('warn message'),
        ''
      );
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('error message'),
        ''
      );
      
      // Restore console
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });
  });
});
