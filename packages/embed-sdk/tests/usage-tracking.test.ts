/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Embed SDK - Usage Tracking Tests
 *  Tests for usage events, metrics, and billing backend integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createDevtoolsSandbox, 
  DruOSUsageEvent,
  DruOSSandboxHandle
} from '../src/index.js';

// Mock UUID
vi.mock('uuid', () => ({
  v4: () => 'test-session-usage-tracking'
}));

describe('Embed SDK - Usage Event Tracking', () => {
  let container: HTMLElement;
  let capturedEvents: DruOSUsageEvent[] = [];
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    capturedEvents = [];
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Event Types', () => {
    it('should emit sandbox_started on creation', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => capturedEvents.push(event)
      });
      
      const startEvent = capturedEvents.find(e => e.type === 'sandbox_started');
      expect(startEvent).toBeDefined();
      expect(startEvent?.timestamp).toBeDefined();
      expect(startEvent?.timestamp).toBeGreaterThan(0);
    });

    it('should emit sandbox_stopped on destroy', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => capturedEvents.push(event)
      });
      
      await handle.destroy();
      
      const stopEvent = capturedEvents.find(e => e.type === 'sandbox_stopped');
      expect(stopEvent).toBeDefined();
      expect(stopEvent?.data?.duration).toBeDefined();
      expect(stopEvent?.data?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include metrics in stop event', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => capturedEvents.push(event)
      });
      
      await handle.destroy();
      
      const stopEvent = capturedEvents.find(e => e.type === 'sandbox_stopped');
      expect(stopEvent?.metrics).toBeDefined();
      expect(stopEvent?.metrics).toHaveProperty('commandCount');
      expect(stopEvent?.metrics).toHaveProperty('httpRequestCount');
      expect(stopEvent?.metrics).toHaveProperty('storageOperationCount');
    });
  });

  describe('Event Structure', () => {
    it('should include all required fields in events', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        tenantId: 'test-tenant',
        userId: 'test-user',
        onEvent: (event) => capturedEvents.push(event)
      });
      
      const event = capturedEvents[0];
      
      expect(event.type).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.sessionId).toBe('test-session-usage-tracking');
      expect(event.tenantId).toBe('test-tenant');
      expect(event.userId).toBe('test-user');
    });

    it('should have valid timestamp format', async () => {
      const beforeTime = Date.now();
      
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => capturedEvents.push(event)
      });
      
      const afterTime = Date.now();
      const event = capturedEvents[0];
      
      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Metrics Tracking', () => {
    it('should initialize metrics to zero', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        onEvent: (event) => capturedEvents.push(event)
      });
      
      const metrics = await handle.getMetrics();
      
      expect(metrics?.cpuTime).toBe(0);
      expect(metrics?.memoryUsed).toBe(0);
      expect(metrics?.commandCount).toBe(0);
      expect(metrics?.httpRequestCount).toBe(0);
      expect(metrics?.storageOperationCount).toBe(0);
    });

    it('should return copy of metrics (immutable)', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      const metrics1 = await handle.getMetrics();
      const metrics2 = await handle.getMetrics();
      
      expect(metrics1).not.toBe(metrics2); // Different object references
      expect(metrics1).toEqual(metrics2);  // Same values
    });

    it('should reset metrics on reset()', async () => {
      const handle = await createDevtoolsSandbox({ container });
      
      // Simulate some activity would increment metrics
      // After reset, they should be zero
      await handle.reset();
      
      const metrics = await handle.getMetrics();
      expect(metrics?.commandCount).toBe(0);
      expect(metrics?.httpRequestCount).toBe(0);
      expect(metrics?.storageOperationCount).toBe(0);
    });
  });
});

describe('Embed SDK - Billing Backend Integration', () => {
  let container: HTMLElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    }) as unknown as ReturnType<typeof vi.fn>;
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Usage Sink', () => {
    it('should NOT send events when usageEndpoint is not configured', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        // No usageEndpoint or apiKey
      });
      
      await handle.destroy();
      
      // fetch should not be called for usage tracking
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should NOT send events when apiKey is missing', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage'
        // No apiKey
      });
      
      await handle.destroy();
      
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should send events when both usageEndpoint and apiKey are configured', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key-123',
        tenantId: 'tenant-xyz'
      });
      
      // Should send sandbox_started event
      expect(fetchMock).toHaveBeenCalled();
      
      const call = fetchMock.mock.calls[0];
      expect(call[0]).toBe('https://billing.example.com/api/usage');
      expect(call[1].method).toBe('POST');
      expect(call[1].headers['Content-Type']).toBe('application/json');
      expect(call[1].headers['X-DruOS-API-Key']).toBe('test-api-key-123');
    });

    it('should include correct payload structure', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key',
        tenantId: 'tenant-123'
      });
      
      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);
      
      expect(payload).toHaveProperty('tenantId', 'tenant-123');
      expect(payload).toHaveProperty('sessionId');
      expect(payload).toHaveProperty('events');
      expect(Array.isArray(payload.events)).toBe(true);
      expect(payload.events.length).toBeGreaterThan(0);
    });

    it('should handle failed requests gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      // Should not throw
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key'
      });
      
      expect(handle.sessionId).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      
      // Should not throw
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key'
      });
      
      expect(handle.sessionId).toBeDefined();
    });

    it('should send stop event to billing backend on destroy', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key'
      });
      
      fetchMock.mockClear();
      
      await handle.destroy();
      
      expect(fetchMock).toHaveBeenCalled();
      
      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);
      const stopEvent = payload.events.find((e: any) => e.type === 'sandbox_stopped');
      
      expect(stopEvent).toBeDefined();
    });
  });

  describe('Event Enrichment', () => {
    it('should add tenantId from options to events', async () => {
      const handle = await createDevtoolsSandbox({
        container,
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'test-api-key',
        tenantId: 'enriched-tenant-id'
      });
      
      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);
      
      expect(payload.events[0].tenantId).toBe('enriched-tenant-id');
    });
  });
});

describe('Embed SDK - Event Validation', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should validate event type is one of allowed types', async () => {
    const events: DruOSUsageEvent[] = [];
    
    const handle = await createDevtoolsSandbox({
      container,
      onEvent: (event) => events.push(event)
    });
    
    await handle.destroy();
    
    const allowedTypes = [
      'sandbox_started',
      'sandbox_stopped', 
      'command_executed',
      'http_request',
      'storage_operation',
      'error',
      'limit_reached',
      'heartbeat'
    ];
    
    events.forEach(event => {
      expect(allowedTypes).toContain(event.type);
    });
  });
});
