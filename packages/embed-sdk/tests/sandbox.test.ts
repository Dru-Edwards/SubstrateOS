/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Embed SDK - Sandbox Tests
 *  Comprehensive tests for createDevtoolsSandbox and window framing
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { 
  createDevtoolsSandbox, 
  quickEmbed,
  DruOSDevtoolsOptions,
  DruOSUsageEvent,
  DruOSSandboxHandle,
  DruOSLimits
} from '../src/index.js';

// Mock UUID
vi.mock('uuid', () => ({
  v4: () => 'test-session-id-12345'
}));

describe('Embed SDK - Sandbox Creation', () => {
  let container: HTMLElement;
  let mockIframe: HTMLIFrameElement;
  let messageHandlers: ((event: MessageEvent) => void)[] = [];
  
  beforeEach(() => {
    // Setup DOM mocks
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    // Track message handlers
    messageHandlers = [];
    const originalAddEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
      if (type === 'message') {
        messageHandlers.push(handler as (event: MessageEvent) => void);
      }
      return originalAddEventListener(type, handler, options);
    });
    
    // Mock fetch for usage sink
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

  describe('createDevtoolsSandbox', () => {
    it('should create an iframe with correct default dimensions', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeDefined();
      expect(iframe?.style.width).toBe('100%');
      expect(iframe?.style.height).toBe('500px');
    });

    it('should apply custom dimensions from style options', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        style: {
          width: '800px',
          height: '600px'
        }
      });
      
      const iframe = container.querySelector('iframe');
      expect(iframe?.style.width).toBe('800px');
      expect(iframe?.style.height).toBe('600px');
    });

    it('should generate a unique session ID', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      expect(handle.sessionId).toBe('test-session-id-12345');
    });

    it('should set correct URL parameters', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        template: 'education-lab',
        tenantId: 'tenant-123',
        userId: 'user-456',
        defaultCommand: 'ls -la',
        style: { theme: 'dark' }
      });
      
      const iframe = container.querySelector('iframe');
      const url = new URL(iframe?.src || '');
      
      expect(url.searchParams.get('template')).toBe('education-lab');
      expect(url.searchParams.get('tenantId')).toBe('tenant-123');
      expect(url.searchParams.get('userId')).toBe('user-456');
      expect(url.searchParams.get('defaultCommand')).toBe('ls -la');
      expect(url.searchParams.get('theme')).toBe('dark');
      expect(url.searchParams.get('embedded')).toBe('true');
    });

    it('should use default endpoint when not specified', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('https://sandbox.druos.dev');
    });

    it('should use custom endpoint when provided', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        endpoint: 'https://custom.sandbox.example.com'
      });
      
      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('https://custom.sandbox.example.com');
    });

    it('should emit sandbox_started event on load', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => events.push(event)
      });
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('sandbox_started');
      expect(events[0].sessionId).toBe('test-session-id-12345');
    });

    it('should include tenant and user IDs in events', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await createDevtoolsSandbox({
        container,
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        onEvent: (event) => events.push(event)
      });
      
      expect(events[0].tenantId).toBe('tenant-abc');
      expect(events[0].userId).toBe('user-xyz');
    });
  });

  describe('Sandbox Handle Methods', () => {
    let handle: DruOSSandboxHandle;
    
    beforeEach(async () => {
      handle = await createDevtoolsSandbox({ container });
    });

    it('execute() should post command message to iframe', async () => {
      const iframe = container.querySelector('iframe');
      const postMessageSpy = vi.fn();
      
      if (iframe?.contentWindow) {
        Object.defineProperty(iframe, 'contentWindow', {
          value: { postMessage: postMessageSpy },
          writable: true
        });
      }
      
      await handle.execute('echo hello');
      
      // Note: postMessage is called during init, so we check the call count
      expect(postMessageSpy).toHaveBeenCalled();
    });

    it('getMetrics() should return current metrics', async () => {
      const metrics = await handle.getMetrics();
      
      expect(metrics).toHaveProperty('cpuTime');
      expect(metrics).toHaveProperty('memoryUsed');
      expect(metrics).toHaveProperty('commandCount');
      expect(metrics).toHaveProperty('httpRequestCount');
      expect(metrics).toHaveProperty('storageOperationCount');
    });

    it('reset() should reset metrics to zero', async () => {
      await handle.reset();
      const metrics = await handle.getMetrics();
      
      expect(metrics?.commandCount).toBe(0);
      expect(metrics?.httpRequestCount).toBe(0);
      expect(metrics?.storageOperationCount).toBe(0);
    });

    it('destroy() should remove iframe and cleanup', async () => {
      const events: DruOSUsageEvent[] = [];
      handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => events.push(event)
      });
      
      await handle.destroy();
      
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeNull();
      
      // Should emit sandbox_stopped event
      const stopEvent = events.find(e => e.type === 'sandbox_stopped');
      expect(stopEvent).toBeDefined();
      expect(stopEvent?.data?.duration).toBeDefined();
    });

    it('destroy() should be idempotent', async () => {
      await handle.destroy();
      await handle.destroy(); // Should not throw
      
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeNull();
    });

    it('execute() should throw after destroy', async () => {
      await handle.destroy();
      
      await expect(handle.execute('test')).rejects.toThrow('Sandbox is destroyed');
    });

    it('reset() should throw after destroy', async () => {
      await handle.destroy();
      
      await expect(handle.reset()).rejects.toThrow('Sandbox is destroyed');
    });

    it('updateEnv() should throw after destroy', async () => {
      await handle.destroy();
      
      await expect(handle.updateEnv({ TEST: 'value' })).rejects.toThrow('Sandbox is destroyed');
    });
  });

  describe('quickEmbed', () => {
    it('should create sandbox with element ID', async () => {
      const handle = await quickEmbed('test-container');
      
      expect(handle.sessionId).toBeDefined();
      expect(container.querySelector('iframe')).toBeDefined();
    });

    it('should throw for non-existent container', async () => {
      await expect(quickEmbed('non-existent-id')).rejects.toThrow(
        "Container element with ID 'non-existent-id' not found"
      );
    });

    it('should pass options to createDevtoolsSandbox', async () => {
      const events: DruOSUsageEvent[] = [];
      
      const handle = await quickEmbed('test-container', {
        template: 'ai-sandbox',
        onEvent: (event) => events.push(event)
      });
      
      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('template=ai-sandbox');
    });
  });
});

describe('Embed SDK - Window Framing Security', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should set iframe border to none', async () => {
    const handle = await createDevtoolsSandbox({ container });
    const iframe = container.querySelector('iframe');
    
    expect(iframe?.style.border).toBe('none');
  });

  it('should apply border-radius styling', async () => {
    const handle = await createDevtoolsSandbox({ container });
    const iframe = container.querySelector('iframe');
    
    expect(iframe?.style.borderRadius).toBe('8px');
  });

  it('should apply box-shadow styling', async () => {
    const handle = await createDevtoolsSandbox({ container });
    const iframe = container.querySelector('iframe');
    
    expect(iframe?.style.boxShadow).toBe('0 2px 8px rgba(0,0,0,0.1)');
  });
});
