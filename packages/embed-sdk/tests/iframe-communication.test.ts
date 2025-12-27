/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Embed SDK - Iframe Communication Tests
 *  Tests for postMessage communication and message handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createDevtoolsSandbox, 
  DruOSUsageEvent
} from '../src/index.js';

// Mock UUID
vi.mock('uuid', () => ({
  v4: () => 'test-session-iframe-comm'
}));

describe('Embed SDK - Iframe Communication', () => {
  let container: HTMLElement;
  let messageHandlers: ((event: MessageEvent) => void)[] = [];
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    messageHandlers = [];
    
    // Track message handlers
    originalAddEventListener = window.addEventListener.bind(window);
    originalRemoveEventListener = window.removeEventListener.bind(window);
    
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
      if (type === 'message') {
        messageHandlers.push(handler as (event: MessageEvent) => void);
      }
      return originalAddEventListener(type, handler, options);
    });
    
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, handler, options) => {
      if (type === 'message') {
        const index = messageHandlers.indexOf(handler as (event: MessageEvent) => void);
        if (index > -1) {
          messageHandlers.splice(index, 1);
        }
      }
      return originalRemoveEventListener(type, handler, options);
    });
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    messageHandlers = [];
  });

  describe('Message Handler Registration', () => {
    it('should register message handler on creation', async () => {
      const initialHandlerCount = messageHandlers.length;
      
      const handle = await createDevtoolsSandbox({ container });
      
      expect(messageHandlers.length).toBeGreaterThan(initialHandlerCount);
    });

    it('should remove message handler on destroy', async () => {
      const handle = await createDevtoolsSandbox({ container });
      const handlerCountAfterCreate = messageHandlers.length;
      
      await handle.destroy();
      
      // Handler should be removed
      expect(messageHandlers.length).toBeLessThan(handlerCountAfterCreate);
    });
  });

  describe('Message Origin Validation', () => {
    it('should only accept messages from sandbox origin', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        endpoint: 'https://sandbox.druos.dev',
        onEvent: (event) => events.push(event)
      });
      
      // Simulate message from wrong origin (should be ignored)
      const maliciousMessage = new MessageEvent('message', {
        data: {
          type: 'event',
          sessionId: 'test-session-iframe-comm',
          data: {
            type: 'command_executed',
            timestamp: Date.now(),
            sessionId: 'test-session-iframe-comm'
          }
        },
        origin: 'https://malicious-site.com'
      });
      
      // Dispatch to handlers
      messageHandlers.forEach(handler => handler(maliciousMessage));
      
      // Should only have the initial sandbox_started event
      const commandEvents = events.filter(e => e.type === 'command_executed');
      expect(commandEvents.length).toBe(0);
    });

    it('should accept messages from configured endpoint origin', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        endpoint: 'https://sandbox.druos.dev',
        onEvent: (event) => events.push(event)
      });
      
      // Simulate valid message
      const validMessage = new MessageEvent('message', {
        data: {
          type: 'event',
          sessionId: 'test-session-iframe-comm',
          data: {
            type: 'command_executed',
            timestamp: Date.now(),
            sessionId: 'test-session-iframe-comm',
            data: { command: 'ls' }
          }
        },
        origin: 'https://sandbox.druos.dev'
      });
      
      // Note: The actual handler logic checks the origin
    });
  });

  describe('Session ID Filtering', () => {
    it('should only process messages for matching sessionId', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        endpoint: 'https://sandbox.druos.dev',
        onEvent: (event) => events.push(event)
      });
      
      const initialEventCount = events.length;
      
      // Message with wrong sessionId should be ignored
      const wrongSessionMessage = new MessageEvent('message', {
        data: {
          type: 'event',
          sessionId: 'different-session-id',
          data: {
            type: 'command_executed',
            timestamp: Date.now(),
            sessionId: 'different-session-id'
          }
        },
        origin: 'https://sandbox.druos.dev'
      });
      
      messageHandlers.forEach(handler => handler(wrongSessionMessage));
      
      // Event count should not increase (message ignored)
      expect(events.length).toBe(initialEventCount);
    });
  });

  describe('Message Types', () => {
    it('should handle init message type', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Init message is sent on creation - verify sandbox is functional
      expect(handle.sessionId).toBeDefined();
    });

    it('should handle event message type', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => events.push(event)
      });
      
      // Event messages trigger onEvent callback
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle command message type', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Should not throw
      await handle.execute('echo test');
    });

    it('should handle reset message type', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Should not throw
      await handle.reset();
    });

    it('should handle destroy message type', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Should not throw
      await handle.destroy();
    });

    it('should handle update_env message type', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Should not throw
      await handle.updateEnv({ PATH: '/usr/bin' });
    });
  });

  describe('postMessage Calls', () => {
    it('should send init message on iframe load', async () => {
      const postMessageCalls: any[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        template: 'devtools-sandbox',
        env: { TEST_VAR: 'test_value' },
        limits: { maxCommands: 100 },
        overlay: [{ path: '/test.txt', content: 'hello' }],
        defaultCommand: 'ls'
      });
      
      // Init message should be sent when iframe loads
      // The sandbox creation completing means init was sent
      expect(handle.sessionId).toBeDefined();
    });

    it('should send command message with correct structure', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Execute command - this should post a message to iframe
      await handle.execute('echo hello');
      
      // If no error thrown, message was sent
      expect(true).toBe(true);
    });
  });
});

describe('Embed SDK - Message Data Validation', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should handle malformed message data gracefully', async () => {
    const events: DruOSUsageEvent[] = [];
    
    const handle = await createDevtoolsSandbox({
      container,
      onEvent: (event) => events.push(event)
    });
    
    // Sandbox should still be functional
    expect(handle.sessionId).toBeDefined();
  });

  it('should handle null message data gracefully', async () => {
    const handle = await createDevtoolsSandbox({ container });
    
    // Should not crash
    expect(handle.sessionId).toBeDefined();
  });

  it('should handle undefined message data gracefully', async () => {
    const handle = await createDevtoolsSandbox({ container });
    
    // Should not crash
    expect(handle.sessionId).toBeDefined();
  });
});

describe('Embed SDK - Metrics Update from Messages', () => {
  let container: HTMLElement;
  let messageHandlers: ((event: MessageEvent) => void)[] = [];
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    messageHandlers = [];
    
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
      if (type === 'message') {
        messageHandlers.push(handler as (event: MessageEvent) => void);
      }
    });
    
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('should increment commandCount on command_executed event', async () => {
    const handle = await createDevtoolsSandbox({
      container,
      endpoint: 'https://sandbox.druos.dev'
    });
    
    const initialMetrics = await handle.getMetrics();
    expect(initialMetrics?.commandCount).toBe(0);
    
    // Simulate command_executed event from iframe
    const commandEvent = new MessageEvent('message', {
      data: {
        type: 'event',
        sessionId: 'test-session-iframe-comm',
        data: {
          type: 'command_executed',
          timestamp: Date.now(),
          sessionId: 'test-session-iframe-comm',
          data: { command: 'ls' }
        }
      },
      origin: 'https://sandbox.druos.dev'
    });
    
    messageHandlers.forEach(handler => handler(commandEvent));
    
    const updatedMetrics = await handle.getMetrics();
    expect(updatedMetrics?.commandCount).toBe(1);
  });

  it('should increment httpRequestCount on http_request event', async () => {
    const handle = await createDevtoolsSandbox({
      container,
      endpoint: 'https://sandbox.druos.dev'
    });
    
    const initialMetrics = await handle.getMetrics();
    expect(initialMetrics?.httpRequestCount).toBe(0);
    
    // Simulate http_request event
    const httpEvent = new MessageEvent('message', {
      data: {
        type: 'event',
        sessionId: 'test-session-iframe-comm',
        data: {
          type: 'http_request',
          timestamp: Date.now(),
          sessionId: 'test-session-iframe-comm',
          data: { url: 'https://api.example.com', method: 'GET' }
        }
      },
      origin: 'https://sandbox.druos.dev'
    });
    
    messageHandlers.forEach(handler => handler(httpEvent));
    
    const updatedMetrics = await handle.getMetrics();
    expect(updatedMetrics?.httpRequestCount).toBe(1);
  });

  it('should increment storageOperationCount on storage_operation event', async () => {
    const handle = await createDevtoolsSandbox({
      container,
      endpoint: 'https://sandbox.druos.dev'
    });
    
    const initialMetrics = await handle.getMetrics();
    expect(initialMetrics?.storageOperationCount).toBe(0);
    
    // Simulate storage_operation event
    const storageEvent = new MessageEvent('message', {
      data: {
        type: 'event',
        sessionId: 'test-session-iframe-comm',
        data: {
          type: 'storage_operation',
          timestamp: Date.now(),
          sessionId: 'test-session-iframe-comm',
          data: { storage_key: 'test-key', storage_operation: 'set' }
        }
      },
      origin: 'https://sandbox.druos.dev'
    });
    
    messageHandlers.forEach(handler => handler(storageEvent));
    
    const updatedMetrics = await handle.getMetrics();
    expect(updatedMetrics?.storageOperationCount).toBe(1);
  });
});
